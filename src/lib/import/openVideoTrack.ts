import { BlobSource, Input, MATROSKA, MP4, QTFF, WEBM, type InputVideoTrack } from "mediabunny";

/** Containers videos can be read from: MP4/M4V/3GP, MOV, WebM and MKV. */
export const VIDEO_INPUT_FORMATS = [MP4, QTFF, WEBM, MATROSKA];

/**
 * Open a video file with Mediabunny and return its main video track, or `null`
 * when the file isn't a readable container or has no video. The caller must
 * call `dispose()` when done. The file is read in place, on the device.
 */
export async function openVideoTrack(
  file: Blob,
): Promise<{ track: InputVideoTrack | null; dispose: () => void }> {
  const input = new Input({ source: new BlobSource(file), formats: VIDEO_INPUT_FORMATS });
  const dispose = () => input.dispose();
  try {
    if (!(await input.canRead())) return { track: null, dispose };
    return { track: await input.getPrimaryVideoTrack(), dispose };
  } catch {
    return { track: null, dispose };
  }
}
