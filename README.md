# Panelly

A browser-based story composer. The user picks a frame layout, drops a photo **or** a video into each panel, and exports a single 1080×1920 MP4 ready to post to Instagram or Facebook Stories.

No install, no account, no upload. Everything runs in the browser.

---

## 1. Product scope (v1)

### Must have

- Pick a layout: **3 horizontal panels** (default), 2 panels, 4 panels.
- Each panel independently holds **a photo or a video**. Mixing is the core feature: panel 1 photo, panel 2 video, panel 3 photo must work.
- Drag to reposition and pinch/scroll to zoom the media **inside** its panel (cover-fit, cropped to the panel box).
- Per-panel mute toggle; **audio is muted by default on every panel**.
- Output is capped at **15 seconds**, 1080×1920, H.264 MP4.
- Export runs **client-side**. The file never leaves the device.
- Download the result; on mobile, also offer the Web Share API so the user can send it straight to Instagram.
- Works on a mid-range Android phone in Chrome and on iPhone Safari.

### Explicitly NOT in v1

Accounts, payments, cloud storage, saved projects, text overlays, stickers, filters, music tracks, audio mixing across panels, server-side rendering, template packs, analytics dashboards. Do not build these. Do not add a paywall.

### Design constraints

- Mobile-first. Assume a 390px-wide viewport is the primary target; desktop is secondary.
- The editor must be usable one-handed, with the canvas above and controls below.
- No sign-in wall, no modal before first use. The user lands on a working editor.

---

## 2. Tech stack

- **Next.js (App Router) + TypeScript**, static export, deployed on Vercel free tier.
- **Tailwind CSS** for styling.
- **Zustand** for editor state.
- **WebCodecs** (`VideoDecoder` / `VideoEncoder`) for the export pipeline.
- **`mp4-muxer`** (npm) to write the MP4 container.
- **`mp4box.js`** to demux input MP4/MOV files into encoded chunks for `VideoDecoder`.
- No backend. No database. No external API calls.

---

## 3. Data model

```ts
type MediaKind = 'image' | 'video';

interface PanelMedia {
  kind: MediaKind;
  file: File;
  objectUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  durationMs: number;      // 0 for images
  muted: boolean;          // always starts true
}

interface Transform {
  scale: number;           // >= 1, 1 = cover-fit
  offsetX: number;         // normalized -1..1 from centre
  offsetY: number;
}

interface Panel {
  id: string;
  rect: { x: number; y: number; w: number; h: number }; // px in the 1080x1920 output space
  media: PanelMedia | null;
  transform: Transform;
}

interface Layout {
  id: string;
  name: string;
  panels: Array<Pick<Panel, 'rect'>>;
  gapPx: number;
  backgroundColor: string;
}

interface Project {
  layoutId: string;
  panels: Panel[];
  durationMs: number;      // computed, hard-capped at 15000
  audioPanelId: string | null;  // which panel's audio survives; null = silent
}
```

### Output space

All geometry is authored against a fixed **1080×1920** coordinate space. The on-screen canvas is a scaled view of it. Never compute layout in CSS pixels; scale at render time only.

### Default 3-panel layout

```
gapPx = 8, background = #000
panel 0: { x: 0, y: 0,    w: 1080, h: 634 }
panel 1: { x: 0, y: 643,  w: 1080, h: 634 }
panel 2: { x: 0, y: 1286, w: 1080, h: 634 }
```

---

## 4. Duration rules

`project.durationMs = min(15000, max(durationMs of all video panels))`. If there are no videos, the project is a still image export (see §6.4).

Per panel:

- **Image** → shown for the whole duration.
- **Video shorter than the project duration** → **loop** it. (Loop is the v1 rule. Do not add freeze/trim options.)
- **Video longer than 15s** → use the first 15s.

---

## 5. Import pipeline

1. Accept via file input and drag-and-drop. `accept="image/*,video/*"`.
2. Read dimensions and duration by loading into an offscreen `<img>` or `<video>`.
3. **Reject early, with a clear message**, if: the file is over 200MB, or video dimensions exceed 4096 on either side.
4. **Downscale on import.** If a video's shorter side exceeds 1080, note a target scale and apply it during decode. Never hold 4K frames in memory.
5. Probe codec support with `VideoDecoder.isConfigSupported()`. If the file cannot be decoded (common with some iPhone HEVC `.mov` files), show: *"This video format isn't supported in your browser. Try re-saving it, or use a different clip."* Do not fail silently.

---

## 6. Export pipeline

This is the hard part and the reason the project exists. Build it in this order.

### 6.1 Primary path — WebCodecs

1. For each video panel: demux with **mp4box.js** → feed `EncodedVideoChunk`s to a `VideoDecoder` → receive `VideoFrame`s.
2. Maintain a frame cursor per panel. Target **30fps**; total frames = `durationMs / 1000 * 30`.
3. For each output frame index `i`:
   - Clear a 1080×1920 `OffscreenCanvas` to the background colour.
   - For each panel: pick the source frame whose timestamp is nearest to `i / 30` (looping with modulo against that clip's duration), then `drawImage` it into `panel.rect` applying `transform` with cover-fit cropping.
   - Images draw the same bitmap every frame.
   - Construct a `VideoFrame` from the canvas with `timestamp = i * (1_000_000 / 30)` microseconds.
   - Feed it to the `VideoEncoder`, then **`.close()` every `VideoFrame`**. Leaking frames will crash the tab.
4. Encoder config: `codec: 'avc1.42001f'` (H.264 baseline, widely compatible), `width: 1080`, `height: 1920`, `bitrate: 6_000_000`, `framerate: 30`, `avc: { format: 'avc' }`.
5. Mux the encoded chunks with `mp4-muxer` into an MP4 with a `faststart`-style layout so the file plays before it's fully buffered.
6. **Audio:** if `audioPanelId` is set, pass that panel's audio track through to the muxer unchanged. If any part of audio handling proves unreliable, **ship v1 silent** and say so in the UI. Silent is acceptable; broken audio is not.

### 6.2 Backpressure

Check `encoder.encodeQueueSize` before each `encode()` call. If it exceeds ~10, `await encoder.flush()` or yield to the event loop. Without this, phones run out of memory.

### 6.3 Fallback — canvas + MediaRecorder

If `'VideoEncoder' in window` is false:

- Render the composite to a canvas in real time and capture with `MediaRecorder` via `canvas.captureStream(30)`.
- This records in real time (a 15s video takes 15s) and most browsers produce **WebM**, which Instagram will reject.
- So in this path: show a clear warning that the download may need converting, and label it "limited mode."
- Do **not** add `ffmpeg.wasm` to rescue this. It is too heavy for the target devices.

### 6.4 All-images shortcut

If no panel holds a video, export a **PNG** instead of a video. Instant, no encoding, better quality.

### 6.5 Progress and cancellation

Show a real progress percentage based on frames encoded. Provide a cancel button that closes the decoders, the encoder, and every outstanding `VideoFrame`.

---

## 7. UI

Single page, three regions stacked vertically on mobile:

1. **Canvas** — the 1080×1920 preview, scaled to fit. Tapping an empty panel opens the file picker. Tapping a filled panel selects it.
2. **Panel controls** (shown when a panel is selected) — zoom slider, mute toggle (videos only), replace, remove.
3. **Bottom bar** — layout picker, Export button, progress state.

Preview playback: a loop button that plays all video panels in sync against a single `requestAnimationFrame` clock. Preview quality does not need to match export quality, but **the framing must be identical** — if the preview crops differently from the export, the product is broken.

---

## 8. Milestones

Build and verify in this order. Do not move on until the previous step works on a real phone.

| # | Deliverable | Done when |
|---|---|---|
| 1 | Layout + canvas renderer | Three empty panels render at the right proportions on mobile |
| 2 | Image import, drag, zoom | Three photos, positioned by the user, export as PNG |
| 3 | Video import + preview | A video plays inside its panel, looping, synced with the others |
| 4 | **WebCodecs export** | A mixed photo/video project downloads as a playable MP4 |
| 5 | Device testing | Verified on a mid-range Android (Chrome) and an iPhone (Safari 16.4+) |
| 6 | Fallback + error states | Unsupported browsers and bad files fail with a clear message, never a blank screen |

Milestone 4 is the whole project. If it works, everything else is polish.

---

## 9. Acceptance test

Panel 1: a JPEG. Panel 2: a 6-second MOV from an iPhone. Panel 3: a 20-second MP4 from an Android phone.

Expected: project duration is 15s. Panel 2 loops twice plus a partial. Panel 3 is truncated at 15s. Output is silent by default. The exported MP4 is 1080×1920, plays in the native photo viewer, and uploads to Instagram Stories without being re-encoded into a mess.

Export should complete in **under 20 seconds** on a mid-range Android phone.

---

## 10. Notes for the implementer

- **Memory is the enemy.** Close every `VideoFrame`. Never hold more than a few decoded frames per panel. Test with three 15-second 1080p clips at once.
- **Test on real phones early**, not just desktop Chrome. Desktop will hide every performance problem.
- **No analytics, no trackers, no fonts loaded from third parties** in v1. The privacy story ("your files never leave your phone") is a selling point — keep it literally true.
- Keep all editor state in one Zustand store so a "save project" feature is a serialization problem later, not a refactor.
- Write the frame-compositing function (`drawPanel(ctx, panel, sourceBitmap)`) so the preview renderer and the export renderer call the **same** code. This is the single most important structural decision in the codebase.
