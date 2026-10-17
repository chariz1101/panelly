/** Seconds-scale timestamp → integer microseconds, as `EncodedVideoChunk` wants. */
export function toMicroseconds(value: number, timescale: number): number {
  return Math.round((value * 1_000_000) / timescale);
}

/**
 * Whether a sample is needed to render the first `maxDurationMs` of a clip.
 * Judged on decode time, not presentation time: with B-frames a sample shown
 * before the cut can depend on one decoded after it, so decoding order is the
 * safe cut line. Anything past the cut is never held in memory (SPEC §4, §10).
 */
export function isWithinWindow(dts: number, timescale: number, maxDurationMs: number): boolean {
  return (dts * 1000) / timescale < maxDurationMs;
}

/**
 * Clockwise display rotation (0/90/180/270) from an MP4 `tkhd` matrix, whose
 * entries are 16.16 fixed point `[a, b, u, c, d, v, x, y, w]`. Phones record
 * portrait video as landscape samples plus a rotation; `VideoDecoder` frames
 * ignore it, unlike `<video>`, so export has to apply it itself.
 */
export function rotationFromMatrix(matrix: ArrayLike<number>): number {
  const a = (matrix[0] ?? 0x10000) / 0x10000;
  const b = (matrix[1] ?? 0) / 0x10000;
  const degrees = Math.round((Math.atan2(b, a) * 180) / Math.PI);
  return (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
}
