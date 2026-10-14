/** Largest file accepted on import (SPEC §5.3). */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

/** Returns a user-facing message if the file is too big, otherwise `null`. */
export function validateFileSize(file: { size: number }): string | null {
  if (file.size <= MAX_FILE_BYTES) return null;
  const mb = Math.round(file.size / (1024 * 1024));
  return `That file is too big (${mb} MB). The limit is 200 MB.`;
}

/** Largest video width or height accepted on import (SPEC §5.3). */
export const MAX_VIDEO_DIMENSION = 4096;

/** Returns a user-facing message if the video is too large, otherwise `null`. */
export function validateVideoDimensions(size: { width: number; height: number }): string | null {
  if (size.width <= MAX_VIDEO_DIMENSION && size.height <= MAX_VIDEO_DIMENSION) return null;
  return `That video is too large (${size.width}×${size.height}). The limit is ${MAX_VIDEO_DIMENSION} px on each side.`;
}
