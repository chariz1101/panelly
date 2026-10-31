/** Shown when the browser refuses to read a picked file (SPEC §5.3, §8). */
export const UNREADABLE_FILE_MESSAGE =
  "Couldn't read that file. If it's in the cloud (e.g. Google Photos), download it to your phone first, then pick it again.";

/** True on Android, the only platform where a picked file can stop being readable. */
export function needsSnapshot(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/**
 * On Android, copies a picked file's bytes into memory right away. There the
 * picker's file reference can stop being readable ("NotReadableError") once
 * the picker closes, e.g. for cloud-backed files, so later probes and the
 * export worker would fail. The returned `File` is backed by our own copy.
 *
 * Elsewhere the file is returned as is. On iPhone a full in-memory copy of a
 * large video (time-lapses and edited videos are re-encoded by the picker)
 * can push Safari over its memory limit, which reloads the page.
 */
export async function snapshotFile(
  file: File,
  userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
): Promise<File> {
  if (!needsSnapshot(userAgent)) return file;
  try {
    const bytes = await file.arrayBuffer();
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    throw new Error(UNREADABLE_FILE_MESSAGE);
  }
}
