# Panelly v1 — Task List

Tasks in the order to do them, based on [`SPEC.md`](./SPEC.md).
Each phase ends with a **checkpoint**. Do not start the next phase until the checkpoint passes **on a real phone** (SPEC §8).

Section numbers in brackets (e.g. `[§6.1]`) point to SPEC.md.

---

## Phase 0 — Project setup

- [x] **0.1** Set up Next.js (App Router) + TypeScript with `output: 'export'` for static export. `[§2]`
- [x] **0.2** Add Tailwind CSS. Use system fonts only, with no Google Fonts or other third-party fonts. `[§10]`
- [x] **0.3** Install the runtime dependencies: `zustand`, `mp4-muxer`, `mp4box`. `[§2]`
  - ⚠️ `mp4-muxer` is deprecated on npm ("superseded by Mediabunny"). It is installed as the spec requires and still works. Decide before Phase 4 whether to switch to `mediabunny`.
- [x] **0.4** Set up ESLint and Prettier, with `strict` TypeScript.
- [x] **0.5** Add a unit-test runner (Vitest) for the pure logic: geometry, duration, and frame selection.
- [x] **0.6** Lay out the folders:
  - `src/app/`: the page and layout
  - `src/store/`: the Zustand store
  - `src/lib/geometry/`: layouts and cover-fit math
  - `src/lib/render/`: `drawPanel`, used by both preview and export
  - `src/lib/import/`: probing and validation
  - `src/lib/export/`: WebCodecs, the fallback, and PNG
  - `src/components/`: the UI
- [x] **0.7** Connect the repo to Vercel (free tier) so each PR gets a preview URL to open on a phone.
- [x] **0.8** Add a CI workflow that runs lint, typecheck, tests, and `next build` on every PR.

**Checkpoint:** an empty page deploys to Vercel and loads on a phone.

---

## Phase 1 — Data model, layouts, and the canvas renderer (Milestone 1)

- [x] **1.1** Write the types from SPEC §3 (`MediaKind`, `PanelMedia`, `Transform`, `Panel`, `Layout`, `Project`) in `src/types.ts`. `[§3]`
- [x] **1.2** Define the layout presets in the 1080×1920 output space: `[§1, §3]`
  - 3 horizontal panels (the default)
  - 2 panels
  - 4 panels
  - ⚠️ The spec says the 3-panel layout has `gapPx = 8`, but its rects leave **9 px** gaps (0–634, 643–1277, 1286–1920). Choose one value and make the rects match it.
- [ ] **1.3** Create the Zustand store, which is the single source of all editor state: `[§10]`
  - Layout, panels, selected panel, `audioPanelId`, playback state, and export state.
  - Actions: `setLayout`, `setMedia`, `removeMedia`, `setTransform`, `selectPanel`, `toggleMute`.
  - Keep it serializable apart from `File` and object URLs, so "save project" can be added later.
- [ ] **1.4** Write the cover-fit math as a pure function: given the media size, the panel rect, and a `Transform`, return the source crop rect. Clamp offsets so the panel never shows empty space. Unit-test it. `[§3]`
- [ ] **1.5** Write **`drawPanel(ctx, panel, source)`**, the one compositing function shared by preview and export. It clips to `panel.rect` and draws the source with the cover-fit crop. It accepts `HTMLImageElement | ImageBitmap | HTMLVideoElement | VideoFrame`. `[§10]`
- [ ] **1.6** Write `renderComposite(ctx, project, sources)`: fill the background colour, then call `drawPanel` for each panel.
- [ ] **1.7** Build the preview canvas component:
  - The backing store is 1080×1920.
  - CSS scales it to fit the viewport while keeping the 9:16 ratio.
  - Never compute layout in CSS pixels. `[§3]`
- [ ] **1.8** Build the mobile-first page shell:
  - Canvas on top, then a panel controls area, then the bottom bar.
  - Target a 390px-wide viewport and one-handed use.
  - No modal or sign-in. The user lands on the editor. `[§1, §7]`
- [ ] **1.9** Add empty-panel placeholders: a "+" hint drawn in each empty panel.

**Checkpoint:** three empty panels render at the right proportions on a phone. Switching between the 2-, 3-, and 4-panel layouts works.

---

## Phase 2 — Image import, drag, zoom, and PNG export (Milestone 2)

- [ ] **2.1** Add a hidden file input with `accept="image/*,video/*"`. Tapping an empty panel opens it. `[§5.1, §7]`
- [ ] **2.2** Support dropping a file onto a panel on desktop. `[§5.1]`
- [ ] **2.3** Probe images: load the file into an offscreen `<img>`, read its natural size, create an object URL, and fill in `PanelMedia`. `[§5.2]`
- [ ] **2.4** Validate on import: reject files over 200 MB with a clear message. `[§5.3]`
- [ ] **2.5** Selection: tapping a filled panel selects it and highlights it on the canvas. `[§7]`
- [ ] **2.6** Drag to reposition: pointer events update `offsetX/offsetY`, normalized to -1..1 and clamped. `[§1]`
- [ ] **2.7** Zoom: pinch on touch, scroll wheel on desktop, and a zoom slider in the panel controls. Keep `scale >= 1`. `[§1, §7]`
- [ ] **2.8** Panel controls: **Replace** and **Remove**. Revoke object URLs on remove or replace. `[§7]`
- [ ] **2.9** Layout picker in the bottom bar. Decide what switching layouts does to existing media (for example, keep the media for panels that still exist) and implement it. `[§7]`
- [ ] **2.10** **All-images export:** when there are no videos, render the composite to a 1080×1920 `OffscreenCanvas` (or a regular canvas) using the same `renderComposite`, then call `toBlob('image/png')`. `[§6.4]`
- [ ] **2.11** Download plus the Web Share API: use `navigator.share({ files })` when `navigator.canShare` allows it, and fall back to an `<a download>` link. `[§1]`

**Checkpoint:** three photos, positioned by the user on a phone, export as a PNG. The framing in the PNG matches the preview exactly.

---

## Phase 3 — Video import and synced preview (Milestone 3)

- [ ] **3.1** Probe videos: load the file into an offscreen `<video>` (`muted`, `playsInline`, `preload="metadata"`) and read `videoWidth`, `videoHeight`, and `duration`. `[§5.2]`
- [ ] **3.2** Reject videos larger than 4096 px on either side, with a clear message. `[§5.3]`
- [ ] **3.3** Record a downscale target: if the shorter side is over 1080, store a scale factor to apply during decode. `[§5.4]`
- [ ] **3.4** Probe codecs: demux the first few samples with mp4box.js and call `VideoDecoder.isConfigSupported()`. If the codec is unsupported, show the exact message from SPEC §5.5. Never fail silently. `[§5.5]`
- [ ] **3.5** Compute the duration: `durationMs = min(15000, max(video durations))`. Make it a derived selector and unit-test it. `[§4]`
- [ ] **3.6** Write `sourceTimeFor(panel, tMs)`: loop shorter clips with modulo and use only the first 15 s of longer ones. This exact function is reused by export. Unit-test it. `[§4]`
- [ ] **3.7** Build a single `requestAnimationFrame` clock that drives every video panel. Each frame, seek or sync each `<video>` to `sourceTimeFor` and redraw with `renderComposite`. `[§7]`
- [ ] **3.8** Add a play/loop button in the bottom bar, and pause when the tab is hidden. `[§7]`
- [ ] **3.9** Add a per-panel mute toggle for video panels only. Videos start muted. Unmuting a panel sets `audioPanelId`, and only one panel can be unmuted at a time. `[§1, §3]`
- [ ] **3.10** Handle iOS quirks: use `playsInline` and `muted` for autoplay, and start playback from a user gesture.

**Checkpoint:** a video plays inside its panel on a phone, loops, and stays in sync with the other video panels. Photos and videos can be mixed.

---

## Phase 4 — WebCodecs export (Milestone 4, the core of the project)

- [ ] **4.1** Run the export in a **Web Worker** so the UI stays responsive. Send it the files, the layout, and the transforms. If a worker turns out to be impractical, run it on the main thread and yield often.
- [ ] **4.2** Demux each video panel's MP4/MOV with mp4box.js into `EncodedVideoChunk`s, and build a `VideoDecoderConfig` that includes the `description` (avcC/hvcC). `[§6.1.1]`
- [ ] **4.3** Give each panel a decoder and frame cursor:
  - Hold only a small ring buffer of decoded frames (at most a few) and **close** frames once they are passed. `[§6.1.2, §10]`
  - To loop, reset the decoder and seek to the keyframe at the start of the clip.
  - Apply the downscale from 3.3 by drawing frames into a smaller canvas or by setting the decoder's display size, so 4K frames are never held. `[§5.4]`
- [ ] **4.4** Frame loop: for each `i` in `0 … durationMs/1000*30`: `[§6.1.3]`
  - Pick the nearest source frame for each panel using `sourceTimeFor(i / 30)`.
  - Composite with the same `renderComposite` / `drawPanel` used by the preview.
  - Create `new VideoFrame(canvas, { timestamp: i * 1_000_000 / 30 })`, encode it, then **close** it.
- [ ] **4.5** Configure the encoder: `avc1.42001f`, 1080×1920, 6 Mbps, 30 fps, `avc: { format: 'avc' }`. Check it with `VideoEncoder.isConfigSupported` first. `[§6.1.4]`
  - ⚠️ Level `1f` (3.1) is officially below 1080×1920. If browsers reject it, use `avc1.42002a` (level 4.2) or `avc1.640028` (High 4.0).
- [ ] **4.6** Backpressure: if `encoder.encodeQueueSize > 10`, yield or `await` before encoding the next frame. `[§6.2]`
- [ ] **4.7** Mux with `mp4-muxer` using `fastStart: 'in-memory'`, and return a `Blob` of type `video/mp4`. `[§6.1.5]`
- [ ] **4.8** Show progress as a percentage of frames encoded, sent from the worker to the UI. `[§6.5]`
- [ ] **4.9** Cancel: close every decoder, the encoder, and any outstanding `VideoFrame`, terminate the worker, and reset the UI. `[§6.5]`
- [ ] **4.10** Reuse the download and share flow from 2.11 for the MP4.
- [ ] **4.11** Audio: for v1, **ship silent**. Show "Exports are silent in this version" in the UI near the mute toggles. Audio passthrough for `audioPanelId` (demuxing AAC from mp4box into the muxer) is an optional extra, and only if it is fully reliable. `[§6.1.6]`
- [ ] **4.12** Memory test: three 15-second 1080p clips at once, with no crash and steady memory. `[§10]`

**Checkpoint:** a mixed photo/video project downloads as a playable 1080×1920 MP4. The framing matches the preview.

---

## Phase 5 — Device testing and performance (Milestone 5)

- [ ] **5.1** Run the **acceptance test** from SPEC §9 on a mid-range Android phone in Chrome: `[§9]`
  - Panel 1: a JPEG.
  - Panel 2: a 6 s iPhone MOV. It should loop twice, then play partially.
  - Panel 3: a 20 s Android MP4. It should be cut at 15 s.
  - Expected: a 15 s silent MP4 at 1080×1920 that plays in the native gallery and uploads to Instagram Stories cleanly.
- [ ] **5.2** Run the same test on an iPhone in Safari 16.4+.
- [ ] **5.3** Export time under **20 s** on the Android phone. Profile and optimize where needed: decode-ahead, avoid `getImageData`, and reuse canvases. `[§9]`
- [ ] **5.4** Check that the preview and the export crop identically, using side-by-side screenshots for each layout. `[§7]`
- [ ] **5.5** Test one-handed use at a 390px width: tap targets of at least 44px and controls within thumb reach. `[§1]`
- [ ] **5.6** Write down the devices and browser versions tested, with their results, in `docs/DEVICE_TESTING.md`.

**Checkpoint:** verified on both target phones.

---

## Phase 6 — Fallback and error states (Milestone 6)

- [ ] **6.1** Feature-detect: `'VideoEncoder' in window` / `'VideoDecoder' in window`. `[§6.3]`
- [ ] **6.2** **Limited mode** fallback: play the composite in real time on a canvas and record it with `canvas.captureStream(30)` and `MediaRecorder`. `[§6.3]`
  - Use MP4 if `MediaRecorder.isTypeSupported('video/mp4')`, otherwise WebM.
  - Label the mode "Limited mode" and warn that the file may need converting before Instagram accepts it.
  - **Do not** add `ffmpeg.wasm`.
- [ ] **6.3** Show clear errors for:
  - files that are too big
  - dimensions that are too large
  - unsupported codecs
  - a corrupt or failed decode
  - an encoder error
  - running out of memory
  - share being unavailable
- [ ] **6.4** Add a React error boundary so the app never shows a blank screen and always offers a way to recover. `[§8]`
- [ ] **6.5** Show a friendly message for browsers that are too old for the editor at all.

**Checkpoint:** unsupported browsers and bad files fail with a clear message, never a blank screen.

---

## Phase 7 — Release

- [ ] **7.1** Privacy audit: no network requests after the page loads, no analytics, no third-party fonts or scripts. Check this in DevTools → Network. `[§10]`
- [ ] **7.2** Accessibility pass: labels on icon buttons, visible focus states, and enough colour contrast.
- [ ] **7.3** Metadata: title, description, favicon, and `theme-color`. A PWA manifest is optional.
- [ ] **7.4** Production deploy to Vercel, then a final run of the acceptance test against the production URL.
- [ ] **7.5** Update the README with a live link and the known limitations (silent export, limited mode).

---

## Out of scope for v1. Do not build. `[§1]`

Accounts, payments or paywall, cloud storage, saved projects, text overlays, stickers, filters, music tracks, audio mixing across panels, server-side rendering, template packs, analytics.
