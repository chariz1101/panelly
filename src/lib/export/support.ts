/** Minimal view of the global scope, injectable so detection is unit-testable. */
export type SupportEnv = object;

/** True when the browser has both halves of WebCodecs (SPEC §6.3). */
export function hasWebCodecs(env: SupportEnv = globalThis): boolean {
  return "VideoEncoder" in env && "VideoDecoder" in env;
}

/** Recorder containers in order of preference: MP4 is what Instagram accepts. */
const RECORDER_TYPES = [
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/** First container `MediaRecorder` can produce, or null when none is usable. */
export function pickRecorderMime(isTypeSupported: (type: string) => boolean): string | null {
  return RECORDER_TYPES.find((type) => isTypeSupported(type)) ?? null;
}

/** File extension for a recorded blob type. */
export function extensionForMime(mime: string): "mp4" | "webm" {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

export type ExportMode = "full" | "limited";

/** WebCodecs → the normal pipeline; otherwise Limited mode (SPEC §6.3). */
export function exportModeFor(env: SupportEnv = globalThis): ExportMode {
  return hasWebCodecs(env) ? "full" : "limited";
}

export const LIMITED_MODE_WARNING =
  "Limited mode: this browser can't encode video directly, so the export is recorded in real time and may be a WebM file. You may need to convert it before Instagram accepts it.";
