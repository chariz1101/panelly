import { OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";

/** H.264 codec strings to try, in order of preference (SPEC §6.1.4, TASKS 4.5). */
export const ENCODER_CODECS = [
  "avc1.42001f", // Baseline 3.1: the spec's choice, widest compatibility
  "avc1.42002a", // Baseline 4.2: officially large enough for 1080×1920
  "avc1.640028", // High 4.0
  // Many Android hardware encoders refuse Baseline, or levels below 4.x, at this size.
  "avc1.4d0028", // Main 4.0
  "avc1.64002a", // High 4.2
  "avc1.4d002a", // Main 4.2
  "avc1.420028", // Baseline 4.0
  "avc1.640032", // High 5.0
] as const;

export const ENCODER_BITRATE = 6_000_000;

/** Tried after every codec fails at `ENCODER_BITRATE`; some hardware encoders cap lower. */
export const FALLBACK_BITRATE = 3_500_000;

/** Pending `encode()` calls above which the next one must wait (SPEC §6.2). */
export const MAX_ENCODE_QUEUE = 10;

export interface EncodeSize {
  width: number;
  height: number;
}

/**
 * Sizes to try, best first. Some phones have no H.264 encoder at 1080×1920; the
 * composite is still drawn at 1080×1920 and scaled down to the first size the
 * browser can encode. 9:16 is kept so the framing is unchanged.
 */
const FULL_SIZE: EncodeSize = { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT };
export const ENCODE_SIZES: readonly EncodeSize[] = [
  FULL_SIZE,
  { width: 720, height: 1280 },
  { width: 540, height: 960 },
];

export function encoderConfigFor(
  codec: string,
  bitrate: number = ENCODER_BITRATE,
  size: EncodeSize = FULL_SIZE,
): VideoEncoderConfig {
  return {
    codec,
    width: size.width,
    height: size.height,
    bitrate,
    framerate: OUTPUT_FPS,
    avc: { format: "avc" },
  };
}

/** Thrown when the browser can't encode any of our H.264 configurations. */
export class EncoderUnsupportedError extends Error {
  constructor(detail?: string) {
    super(
      detail
        ? `This browser can't encode 1080×1920 video. (${detail})`
        : "This browser can't encode 1080×1920 video.",
    );
    this.name = "EncoderUnsupportedError";
  }
}

/** Encoder options varied after the spec config fails; hardware encoders differ per device. */
const VARIANTS: Array<Partial<VideoEncoderConfig>> = [
  {},
  { hardwareAcceleration: "prefer-hardware" },
  { hardwareAcceleration: "prefer-software" },
  // Last resort: leave the bitstream format and framerate to the browser's defaults.
  { avc: undefined, framerate: undefined },
];

/**
 * First config in `ENCODER_CODECS` the browser accepts, checked with
 * `VideoEncoder.isConfigSupported` before any encoding starts. Tries each
 * encoder variant at the spec bitrate, then at a lower one.
 */
export async function pickEncoderConfig(
  isConfigSupported: (config: VideoEncoderConfig) => Promise<VideoEncoderSupport> = (c) =>
    VideoEncoder.isConfigSupported(c),
): Promise<VideoEncoderConfig> {
  let tried = 0;
  let lastError = "";
  for (const size of ENCODE_SIZES) {
    for (const variant of VARIANTS) {
      for (const bitrate of [ENCODER_BITRATE, FALLBACK_BITRATE]) {
        for (const codec of ENCODER_CODECS) {
          const candidate = { ...encoderConfigFor(codec, bitrate, size), ...variant };
          tried++;
          try {
            const { supported, config } = await isConfigSupported(candidate);
            if (supported) return { ...candidate, ...config };
          } catch (err) {
            // A malformed-config rejection means "not this one"; try the next.
            lastError = err instanceof Error ? err.message : String(err);
          }
        }
      }
    }
  }
  throw new EncoderUnsupportedError(
    `${typeof VideoEncoder === "undefined" ? "no VideoEncoder; " : ""}${tried} configs refused${
      lastError ? `: ${lastError}` : ""
    }`,
  );
}
