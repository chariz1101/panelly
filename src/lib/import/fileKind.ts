import type { MediaKind } from "@/types";

/** Value for the file input's `accept` attribute (SPEC §5.1). */
export const ACCEPT = "image/*,video/*";

const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|3gp|webm|mkv)$/i;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i;

/**
 * Classifies a file by MIME type, falling back to the extension because some
 * Android pickers hand over files with an empty `type`; `null` if it is
 * neither an image nor a video.
 */
export function mediaKindOf(file: { type: string; name?: string }): MediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "" || file.type === "application/octet-stream") {
    if (file.name && VIDEO_EXTENSIONS.test(file.name)) return "video";
    if (file.name && IMAGE_EXTENSIONS.test(file.name)) return "image";
  }
  return null;
}
