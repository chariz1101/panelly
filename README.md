# Panelly

A browser-based story composer. Pick a frame layout, drop a photo **or** a video into each panel, and export a single 1080×1920 MP4 ready for Instagram or Facebook Stories.

No install, no account, no upload. Everything runs in the browser, and your files never leave your device.

## Features (v1)

- Layouts with 2, 3 (the default), or 4 stacked panels
- Photos and videos mixed freely across panels
- Drag to reposition, and pinch or scroll to zoom inside each panel
- 15-second, 1080×1920, H.264 MP4 export, rendered client-side with WebCodecs
- PNG export when every panel is a photo
- Download, or share straight to Instagram with the Web Share API on mobile

Live site: **[panelly-official.vercel.app](https://panelly-official.vercel.app)**

Targets mid-range Android (Chrome) and iPhone (Safari 16.4+), mobile-first.

## Known limitations

- **Silent export.** v1 exports have no audio; every panel is muted.
- **Limited mode.** Browsers without WebCodecs (`VideoEncoder`/`VideoDecoder`) fall back to real-time recording with `MediaRecorder`. The file may be MP4 or WebM and may need converting before Instagram accepts it.
- **Video formats.** MP4, MOV, M4V, 3GP, WebM and MKV are read, with H.264, HEVC, VP8, VP9 or AV1 inside. Whether a clip works still depends on the phone: its browser has to both play it (for the preview) and decode it (for export). For example, iPhone Safari doesn't play MKV, and some browsers can't decode certain iPhone HEVC `.mov` files. Re-save the clip or use a different one.
- **Sideways encoding on some phones.** If a browser refuses to encode H.264 at 1080×1920, the same picture is encoded as 1920×1080 with a 90° rotation flag, the way phones store portrait video. It still plays as 1080×1920.
- **Reduced resolution as a last resort.** Only if 1920×1080 is refused too, export falls back to 720×1280 or 540×960.
- Exports are capped at 15 seconds.

## Tech stack

Next.js (App Router, static export) · TypeScript · Tailwind CSS · Zustand · WebCodecs · Mediabunny · Vitest

No backend, no database, no third-party requests.

## Privacy and analytics

Your photos and videos never leave your device. The site uses [Vercel Web Analytics](https://vercel.com/docs/analytics) and [Speed Insights](https://vercel.com/docs/speed-insights), which are cookieless and load from the site's own domain. They record:

- **Page views:** anonymous visits, country, device, browser and referrer.
- **Performance:** Core Web Vitals such as load time.
- **Export events:** `Export` and `Export failed`, with only the export path (PNG, MP4 or Limited mode), the encoded size, how many panels and videos, the length in seconds, and an error category. Never file names, file contents or error text. See `src/lib/analytics/events.ts`.

## Getting started

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script              | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start the dev server                       |
| `npm run build`     | Build the static site into `out/`          |
| `npm run lint`      | Run ESLint                                 |
| `npm run typecheck` | Run the TypeScript compiler with no output |
| `npm test`          | Run the unit tests (Vitest)                |
| `npm run format`    | Format the code with Prettier              |

## Project structure

```
src/
  app/           Next.js page and root layout
  components/    UI components
  store/         Zustand editor store (single source of state)
  lib/
    geometry/    Output space, layouts, cover-fit math
    render/      drawPanel / renderComposite, shared by preview and export
    import/      File probing and validation
    export/      WebCodecs pipeline, MediaRecorder fallback, PNG export
    analytics/   Anonymous export events (Vercel Web Analytics)
brand/           Logo v2 source SVGs (lockups, marks, app and favicon icons)
public/icons/    PWA icons rendered from brand/
docs/            Spec and task list
```

## Brand

Logo v2 comes from the Figma file "own-projects", frame "Panelly logo v2". The mark is a 9:16 story with three equal panels on a 180×320 grid; the wordmark is Lexend Medium, outlined, so no font is loaded.

- **On the site:** `src/components/Logo.tsx` (header, error and unsupported screens).
- **Favicons:** `src/app/favicon.ico` (16/32/48) and `src/app/icon.svg` use the "Small" cut (wider gaps, rounder corners) that the brand sheet specifies for 48 px and below.
- **App icons:** `src/app/apple-icon.png` (180, full bleed; iOS rounds it) and `public/icons/` (192 and 512, plus a 512 maskable icon).
- **Colors on dark:** cyan `#03D2D2` (accent), orange `#F97F00`, plum `#A35686`, on `#0D0D0D`.

## Docs

- [`docs/SPEC.md`](docs/SPEC.md): the full v1 spec, covering scope, data model, the import and export pipelines, the UI, and the acceptance test.
- [`docs/TASKS.md`](docs/TASKS.md): the build tasks in chronological order.
