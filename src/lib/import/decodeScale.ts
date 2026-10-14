/** Shorter side, in px, that decoded video frames are kept at or below (SPEC §5.4). */
export const MAX_DECODE_SHORT_SIDE = 1080;

/**
 * Scale factor (0 < s <= 1) to apply while decoding so that the shorter side
 * is at most 1080 px. Videos already at or under 1080 get exactly 1, so 4K
 * frames are never held in memory (SPEC §5.4).
 */
export function decodeScaleFor(size: { width: number; height: number }): number {
  const shortSide = Math.min(size.width, size.height);
  if (!(shortSide > MAX_DECODE_SHORT_SIDE)) return 1;
  return MAX_DECODE_SHORT_SIDE / shortSide;
}

/** Frame size after applying `scale`, rounded to even numbers as H.264 requires. */
export function scaledSize(
  size: { width: number; height: number },
  scale: number,
): { width: number; height: number } {
  if (scale === 1) return { width: size.width, height: size.height };
  const even = (n: number) => Math.max(2, 2 * Math.round((n * scale) / 2));
  return { width: even(size.width), height: even(size.height) };
}
