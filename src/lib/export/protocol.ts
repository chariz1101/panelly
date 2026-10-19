import type { Project } from "@/types";

/**
 * Everything the export worker needs (SPEC §6.1). `File`s are structured-cloned
 * into the worker; object URLs in `media` are inert there and never used.
 */
export type ExportJob = Pick<Project, "layoutId" | "panels" | "durationMs">;

/** Main thread → worker. */
export type ExportRequest = { type: "start"; job: ExportJob } | { type: "cancel" };

/** Fraction (0..1) of output frames encoded, for the progress readout (SPEC §6.5). */
export function progressFraction(framesDone: number, framesTotal: number): number {
  if (framesTotal <= 0) return 0;
  return Math.min(1, Math.max(0, framesDone / framesTotal));
}

/** Worker → main thread. */
export type ExportEvent =
  | { type: "progress"; framesDone: number; framesTotal: number }
  | { type: "done"; blob: Blob }
  /** The worker stopped on request and has closed its decoders, encoder and frames. */
  | { type: "cancelled" }
  | { type: "error"; message: string };
