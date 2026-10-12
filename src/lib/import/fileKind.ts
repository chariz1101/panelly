import type { MediaKind } from "@/types";

/** Value for the file input's `accept` attribute (SPEC §5.1). */
export const ACCEPT = "image/*,video/*";

/** Classifies a file by MIME type; `null` if it is neither an image nor a video. */
export function mediaKindOf(file: { type: string }): MediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}
