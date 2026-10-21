# Device testing

Results of running the SPEC §9 acceptance test on real phones (TASKS Phase 5).
Reported by the project owner; items without a recorded measurement say so.

## Devices

| Device          | OS             | Browser | Result                       |
| --------------- | -------------- | ------- | ---------------------------- |
| iPhone 13       | iOS 18.7.2     | Safari  | Pass (after the fixes below) |
| Infinix Smart 9 | Android 14.0.1 | Chrome  | Pass (after the fixes below) |

Browser version numbers were not recorded.

## Acceptance test (SPEC §9)

Panel 1 a JPEG, panel 2 a short iPhone MOV, panel 3 a 20 s Android MP4. Import,
synced preview, export, and playback of the exported MP4 all work on both phones.

- Export time (target under 20 s on the Android phone): no timing recorded; the owner reported the tests "all good".
- Preview/export crop match for each layout: covered by the owner's "all good"; no side-by-side screenshots were stored.
- One-handed use at 390 px: covered by the owner's "all good" after the Remove button was moved onto its own row; no per-control tap-target check was recorded.
- Exported size on the Infinix: its browser refused every H.264 config at 1080×1920, so export falls back to 720×1280 or 540×960 (PR #32). Which size it used was not recorded. This is below the spec's 1080×1920; consider showing a notice when it happens.

## Problems found and fixed during testing

| Device  | Problem                                           | Fix                                                             |
| ------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Android | "The source image could not be decoded" on export | Decode images on the main thread, transfer to the worker (#29)  |
| Android | "The requested file could not be read" on import  | Copy picked files into memory immediately (#29)                 |
| Android | Remove button off-screen at 390 px                | Panel controls wrap to two rows (#29)                           |
| Android | "This browser can't encode 1080×1920 video"       | More H.264 profiles, then 720×1280 / 540×960 fallback (#30–#32) |
| iOS     | Video stayed black in the preview                 | Force the first frame to load (#33)                             |
| iOS     | "Encoding task failed" on export                  | Try H.264 level 4.x before the spec's level 3.1 (#33)           |
