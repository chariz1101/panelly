/** Shown when the browser refuses to read a picked file (SPEC §5.3, §8). */
export const UNREADABLE_FILE_MESSAGE =
  "Couldn't read that file. If it's in the cloud (e.g. Google Photos), download it to your phone first, then pick it again.";

/**
 * Copies a picked file's bytes into memory right away. On Android the picker's
 * file reference can stop being readable ("NotReadableError") once the picker
 * closes, e.g. for cloud-backed files, so later probes and the export worker
 * would fail. The returned `File` is backed by our own copy and stays readable.
 */
export async function snapshotFile(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    throw new Error(UNREADABLE_FILE_MESSAGE);
  }
}
