import { createFile, MP4BoxBuffer } from "mp4box";
import { UNSUPPORTED_VIDEO_MESSAGE, codecSupportMessage } from "./codecSupport";

const CHUNK_BYTES = 4 * 1024 * 1024;

/** Reads the first video track's codec string (e.g. `avc1.64001f`) from an MP4/MOV, or `null`. */
async function readVideoCodec(file: File): Promise<string | null> {
  const mp4 = createFile();
  let codec: string | null = null;
  let settled = false;
  mp4.onReady = (info) => {
    settled = true;
    codec = info.videoTracks[0]?.codec ?? null;
  };
  mp4.onError = () => {
    settled = true;
  };
  let offset = 0;
  while (!settled && offset < file.size) {
    const buffer = await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buffer, offset));
    offset = next > offset ? next : offset + buffer.byteLength;
  }
  mp4.flush();
  return codec;
}

/**
 * Checks that this browser can decode the video (SPEC §5.5). Returns `null`
 * when it can, otherwise the user-facing message to show. Never throws and
 * never fails silently.
 */
export async function probeVideoCodec(
  file: File,
  size: { width: number; height: number },
): Promise<string | null> {
  if (typeof VideoDecoder === "undefined") return UNSUPPORTED_VIDEO_MESSAGE;
  try {
    const codec = await readVideoCodec(file);
    if (!codec) return UNSUPPORTED_VIDEO_MESSAGE;
    const result = await VideoDecoder.isConfigSupported({
      codec,
      codedWidth: size.width,
      codedHeight: size.height,
    });
    return codecSupportMessage(codec, result.supported);
  } catch {
    return UNSUPPORTED_VIDEO_MESSAGE;
  }
}
