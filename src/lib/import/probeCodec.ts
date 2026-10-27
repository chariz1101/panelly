import { UNSUPPORTED_VIDEO_MESSAGE, codecSupportMessage } from "./codecSupport";
import { openVideoTrack } from "./openVideoTrack";

/**
 * Checks that this browser can decode the video (SPEC §5.5): reads the main
 * video track's decoder config with Mediabunny and asks
 * `VideoDecoder.isConfigSupported`. Returns `null` when it can, otherwise the
 * user-facing message to show. Never throws and never fails silently.
 */
export async function probeVideoCodec(file: File): Promise<string | null> {
  if (typeof VideoDecoder === "undefined") return UNSUPPORTED_VIDEO_MESSAGE;
  const { track, dispose } = await openVideoTrack(file);
  try {
    const config = track ? await track.getDecoderConfig() : null;
    if (!config) return UNSUPPORTED_VIDEO_MESSAGE;
    const result = await VideoDecoder.isConfigSupported(config);
    return codecSupportMessage(config.codec, result.supported);
  } catch {
    return UNSUPPORTED_VIDEO_MESSAGE;
  } finally {
    dispose();
  }
}
