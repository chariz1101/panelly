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

Targets mid-range Android (Chrome) and iPhone (Safari 16.4+), mobile-first.

## Tech stack

Next.js (App Router, static export) · TypeScript · Tailwind CSS · Zustand · WebCodecs · mp4box.js · mp4-muxer · Vitest

No backend, no database, no analytics, no third-party requests.

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
docs/            Spec and task list
```

## Docs

- [`docs/SPEC.md`](docs/SPEC.md): the full v1 spec, covering scope, data model, the import and export pipelines, the UI, and the acceptance test.
- [`docs/TASKS.md`](docs/TASKS.md): the build tasks in chronological order.
