import { OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";

/** H.264 codec strings to try, in order of preference (SPEC §6.1.4, TASKS 4.5). */
export const ENCODER_CODECS = [
  // Level 4.0+ is what 1080×1920 (8160 macroblocks) needs. Safari reports the
  // spec's Baseline 3.1 as supported, then fails mid-encode with "Encoding task failed".
  "avc1.42002a", // Baseline 4.2: officially large enough for 1080×1920
  "avc1.640028", // High 4.0
  "avc1.4d0028", // Main 4.0
  "avc1.64002a", // High 4.2
  "avc1.4d002a", // Main 4.2
  "avc1.420028", // Baseline 4.0
  "avc1.640032", // High 5.0
  "avc1.42001f", // Baseline 3.1: the spec's choice, last because it is below the size's level
] as const;

export const ENCODER_BITRATE = 6_000_000;

/** Tried after every codec fails at `ENCODER_BITRATE`; some hardware encoders cap lower. */
export const FALLBACK_BITRATE = 3_500_000;

/** Pending `encode()` calls above which the next one must wait (SPEC §6.2). */
export const MAX_ENCODE_QUEUE = 10;

export interface EncodeSize {
  /** Width of the frames the encoder receives (stored width, before rotation). */
  width: number;
  /** Height of the frames the encoder receives (stored height, before rotation). */
  height: number;
  /**
   * Clockwise rotation written into the MP4 so players show it upright. 90 means
   * the 1080×1920 composite is stored sideways as 1920×1080, the way phones store
   * portrait camera video. Defaults to 0.
   */
  rotation?: 0 | 90;
}

/**
 * Sizes to try, best first.
 *
 * 1. 1080×1920 as is.
 * 2. The same 1080×1920 picture stored sideways as 1920×1080 with a 90° flag.
 *    Many Android hardware encoders take landscape 1920×1080 but refuse portrait
 *    1080×1920 (likely because 1080 isn't a multiple of 16). Players still show
 *    it as 1080×1920.
 * 3. Smaller 9:16 sizes, a last resort that loses resolution but keeps framing.
 *
 * The composite is always drawn at 1080×1920 first; see `runFrameLoop`.
 */
const FULL_SIZE: EncodeSize = { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT };
export const ENCODE_SIZES: readonly EncodeSize[] = [
  FULL_SIZE,
  { width: OUTPUT_HEIGHT, height: OUTPUT_WIDTH, rotation: 90 },
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

/** Short label for a size, e.g. "1080x1920" or "1920x1080-rotated". */
export function encodeSizeLabel(size: EncodeSize): string {
  return `${size.width}x${size.height}${size.rotation === 90 ? "-rotated" : ""}`;
}

/** The encoder config to use and the size it was accepted at. */
export interface PickedEncoder {
  config: VideoEncoderConfig;
  size: EncodeSize;
}

/**
 * First config in `ENCODER_CODECS` the browser accepts, checked with
 * `VideoEncoder.isConfigSupported` before any encoding starts. For each size in
 * `ENCODE_SIZES`, tries each encoder variant at the spec bitrate, then a lower one.
 */
export async function pickEncoderConfig(
  isConfigSupported: (config: VideoEncoderConfig) => Promise<VideoEncoderSupport> = (c) =>
    VideoEncoder.isConfigSupported(c),
): Promise<PickedEncoder> {
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
            if (supported) return { config: { ...candidate, ...config }, size };
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
