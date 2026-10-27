import type { Project } from "@/types";

/**
 * Everything the export worker needs (SPEC §6.1). `File`s are structured-cloned
 * into the worker; object URLs in `media` are inert there and never used.
 */
export type ExportJob = Pick<Project, "layoutId" | "panels" | "durationMs">;

/** Main thread → worker. */
export type ExportRequest =
  | {
      type: "start";
      job: ExportJob;
      /**
       * Image panels already decoded on the main thread, keyed by panel id and
       * transferred in. Decoding there reuses the `<img>` the preview shows, which
       * succeeds on files a worker's `createImageBitmap(file)` rejects on Android.
       */
      bitmaps?: Record<string, ImageBitmap>;
    }
  | { type: "cancel" };

/** Fraction (0..1) of output frames encoded, for the progress readout (SPEC §6.5). */
export function progressFraction(framesDone: number, framesTotal: number): number {
  if (framesTotal <= 0) return 0;
  return Math.min(1, Math.max(0, framesDone / framesTotal));
}

/** Worker → main thread. */
export type ExportEvent =
  | { type: "progress"; framesDone: number; framesTotal: number }
  /** `encodedAs` labels the encoder size, e.g. "1080x1920" or "1920x1080-rotated" (analytics). */
  | { type: "done"; blob: Blob; encodedAs: string }
  /** The worker stopped on request and has closed its decoders, encoder and frames. */
  | { type: "cancelled" }
  | { type: "error"; message: string };
