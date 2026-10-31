import { UNSUPPORTED_VIDEO_MESSAGE, codecSupportMessage } from "./codecSupport";
import { openVideoTrack } from "./openVideoTrack";
import { withTimeout } from "./withTimeout";

/** How long the format check may take before the user is told it failed. */
export const CODEC_CHECK_TIMEOUT_MS = 15_000;

export const SLOW_VIDEO_MESSAGE =
  "That video took too long to open. Try again, or use a different clip.";

/**
 * Checks that this browser can decode the video (SPEC §5.5): reads the main
 * video track's decoder config with Mediabunny and asks
 * `VideoDecoder.isConfigSupported`. Returns `null` when it can, otherwise the
 * user-facing message to show. Never throws and never fails silently: if the
 * check hasn't finished after `timeoutMs`, that is reported too.
 */
export function probeVideoCodec(
  file: File,
  timeoutMs: number = CODEC_CHECK_TIMEOUT_MS,
): Promise<string | null> {
  return withTimeout(checkCodec(file), timeoutMs, () => SLOW_VIDEO_MESSAGE);
}

async function checkCodec(file: File): Promise<string | null> {
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
