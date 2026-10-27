/** Seconds → integer microseconds, as `EncodedVideoChunk` wants. */
export function secondsToMicroseconds(seconds: number): number {
  return Math.round(seconds * 1_000_000);
}

/**
 * Whether reading can stop at this packet (in decode order) once the first
 * `maxDurationMs` of the clip is covered. Stopping only at a key packet past
 * the cut keeps every packet the frames before the cut depend on (B-frames
 * reference packets later in decode order, but never past the next keyframe),
 * while nothing beyond one extra group of pictures is held (SPEC §4, §10).
 */
export function isPastWindow(
  packet: { type: "key" | "delta"; timestamp: number },
  firstTimestamp: number,
  maxDurationMs: number,
): boolean {
  return packet.type === "key" && (packet.timestamp - firstTimestamp) * 1000 >= maxDurationMs;
}
