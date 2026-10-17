import { OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";

/** H.264 codec strings to try, in order of preference (SPEC §6.1.4, TASKS 4.5). */
export const ENCODER_CODECS = [
  "avc1.42001f", // Baseline 3.1: the spec's choice, widest compatibility
  "avc1.42002a", // Baseline 4.2: officially large enough for 1080×1920
  "avc1.640028", // High 4.0
] as const;

export const ENCODER_BITRATE = 6_000_000;

/** Pending `encode()` calls above which the next one must wait (SPEC §6.2). */
export const MAX_ENCODE_QUEUE = 10;

export function encoderConfigFor(codec: string): VideoEncoderConfig {
  return {
    codec,
    width: OUTPUT_WIDTH,
    height: OUTPUT_HEIGHT,
    bitrate: ENCODER_BITRATE,
    framerate: OUTPUT_FPS,
    avc: { format: "avc" },
  };
}

/** Thrown when the browser can't encode any of our H.264 configurations. */
export class EncoderUnsupportedError extends Error {
  constructor() {
    super("This browser can't encode 1080×1920 video.");
    this.name = "EncoderUnsupportedError";
  }
}

/**
 * First config in `ENCODER_CODECS` the browser accepts, checked with
 * `VideoEncoder.isConfigSupported` before any encoding starts.
 */
export async function pickEncoderConfig(
  isConfigSupported: (config: VideoEncoderConfig) => Promise<VideoEncoderSupport> = (c) =>
    VideoEncoder.isConfigSupported(c),
): Promise<VideoEncoderConfig> {
  for (const codec of ENCODER_CODECS) {
    try {
      const { supported, config } = await isConfigSupported(encoderConfigFor(codec));
      if (supported) return { ...encoderConfigFor(codec), ...config };
    } catch {
      // A malformed-config rejection means "not this one"; try the next.
    }
  }
  throw new EncoderUnsupportedError();
}
