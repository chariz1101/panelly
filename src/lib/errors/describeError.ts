import { UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/import/codecSupport";

export const OUT_OF_MEMORY_MESSAGE =
  "Your device ran out of memory. Try fewer or shorter clips, or a smaller video, then export again.";
export const DECODE_FAILED_MESSAGE =
  "One of the videos couldn't be read. It may be corrupt. Try re-saving it, or use a different clip.";
export const ENCODER_FAILED_MESSAGE =
  "The video couldn't be encoded on this device. Try again, or remove a clip and export again.";
export const EXPORT_FAILED_MESSAGE = "Export failed. Please try again.";
export const SHARE_UNAVAILABLE_NOTE =
  "Sharing isn't available in this browser, so the file was saved instead.";

/**
 * Turn whatever an export threw into a message a person can act on (SPEC §5.5, §8).
 * Errors from the export worker arrive as plain strings, so classification is by
 * name and message text. Never returns an empty string or a stack trace.
 */
export function describeExportError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const message = (err instanceof Error ? err.message : typeof err === "string" ? err : "").trim();

  // Already a user-facing message (the unsupported-codec text from the demuxer).
  if (message === UNSUPPORTED_VIDEO_MESSAGE) return message;
  if (
    name === "RangeError" ||
    name === "QuotaExceededError" ||
    /memory|allocation|quota/i.test(message)
  ) {
    return OUT_OF_MEMORY_MESSAGE;
  }
  if (
    name === "DemuxError" ||
    name === "EncodingError" ||
    /decod|demux|corrupt|no frames/i.test(message)
  ) {
    return DECODE_FAILED_MESSAGE;
  }
  if (/encod/i.test(message)) return ENCODER_FAILED_MESSAGE;
  return EXPORT_FAILED_MESSAGE;
}
