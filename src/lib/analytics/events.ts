import { track } from "@vercel/analytics";
import {
  DECODE_FAILED_MESSAGE,
  ENCODER_FAILED_MESSAGE,
  OUT_OF_MEMORY_MESSAGE,
} from "@/lib/errors/describeError";
import { UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/import/codecSupport";
import type { Panel } from "@/types";

/**
 * Anonymous export events for Vercel Web Analytics.
 *
 * Only the fixed, non-identifying fields below are ever sent: counts, the
 * export path, the encoded size and an error category. Never file names,
 * file contents, sizes in bytes or error text. The files themselves never
 * leave the device (SPEC §10).
 */

export type ExportFormat = "png" | "mp4" | "webm";
export type ExportMode = "still" | "full" | "limited";
export type ExportFailureReason =
  "out_of_memory" | "decode_failed" | "encoder_failed" | "unsupported_video" | "other";

export interface ExportSucceeded {
  format: ExportFormat;
  mode: ExportMode;
  /** Size the encoder ran at, e.g. "1080x1920" or "1920x1080-rotated". Absent for PNG and Limited mode. */
  encodedAs?: string;
  panels: number;
  videos: number;
  /** Project length in whole seconds. */
  seconds: number;
}

export interface ExportFailed {
  mode: ExportMode;
  reason: ExportFailureReason;
}

/** The counts every export event carries. */
export function projectShape(panels: readonly Pick<Panel, "media">[], durationMs: number) {
  return {
    panels: panels.filter((p) => p.media).length,
    videos: panels.filter((p) => p.media?.kind === "video").length,
    seconds: Math.round(durationMs / 1000),
  };
}

/** Map the user-facing message from `describeExportError` to a category. */
export function failureReason(userMessage: string): ExportFailureReason {
  switch (userMessage) {
    case OUT_OF_MEMORY_MESSAGE:
      return "out_of_memory";
    case DECODE_FAILED_MESSAGE:
      return "decode_failed";
    case ENCODER_FAILED_MESSAGE:
      return "encoder_failed";
    case UNSUPPORTED_VIDEO_MESSAGE:
      return "unsupported_video";
    default:
      return "other";
  }
}

/** Drop undefined fields; Vercel Analytics only accepts plain values. */
function clean(props: object): Record<string, string | number> {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
}

export type Tracker = (name: string, props: Record<string, string | number>) => void;

export function trackExportSucceeded(event: ExportSucceeded, send: Tracker = track): void {
  send("Export", clean(event));
}

export function trackExportFailed(event: ExportFailed, send: Tracker = track): void {
  send("Export failed", clean(event));
}
