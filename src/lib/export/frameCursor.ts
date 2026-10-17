import { OUTPUT_FPS } from "@/lib/geometry/output";
import { scaledSize } from "@/lib/import/decodeScale";

/**
 * Pure maths behind the per-panel frame cursor (SPEC §6.1.2), kept apart from
 * `VideoDecoder` so it can be unit-tested. All times are microseconds.
 */

/** Presentation timestamp of output frame `index` (SPEC §6.1.3). */
export function frameTimestampUs(index: number): number {
  return Math.round((index * 1_000_000) / OUTPUT_FPS);
}

/** Index of the timestamp nearest to `targetUs`; the earlier one wins a tie. -1 if empty. */
export function pickNearest(timestamps: readonly number[], targetUs: number): number {
  let best = -1;
  let bestDistance = Infinity;
  timestamps.forEach((ts, i) => {
    const distance = Math.abs(ts - targetUs);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * How many leading frames (ascending timestamps) can be closed once the cursor
 * is at `targetUs`: every frame that is followed by another frame at or before
 * the target. Targets only move forward between rewinds, so these can never be
 * the nearest frame again.
 */
export function framesToDrop(timestamps: readonly number[], targetUs: number): number {
  let atOrBefore = 0;
  for (const ts of timestamps) {
    if (ts <= targetUs) atOrBefore++;
    else break;
  }
  return Math.max(atOrBefore - 1, 0);
}

/**
 * Chunk index to start decoding from to show `targetUs`: the last keyframe at
 * or before it, else the first keyframe, else 0. Looping seeks to the start of
 * the clip through this (SPEC §6.1.2, task 4.3).
 */
export function seekIndex(
  chunks: ReadonlyArray<{ type: string; timestamp: number }>,
  targetUs: number,
): number {
  let before = -1;
  let first = -1;
  chunks.forEach((chunk, i) => {
    if (chunk.type !== "key") return;
    if (first < 0) first = i;
    if (chunk.timestamp <= targetUs) before = i;
  });
  if (before >= 0) return before;
  return Math.max(first, 0);
}

/**
 * Size a decoded frame is held at: its size after applying the container's
 * rotation (which `VideoDecoder` ignores), then the decode downscale from
 * SPEC §5.4 so 4K frames are never kept.
 */
export function heldFrameSize(
  frame: { width: number; height: number },
  rotation: number,
  scale: number,
): { width: number; height: number } {
  const quarterTurn = rotation % 180 !== 0;
  const upright = quarterTurn
    ? { width: frame.height, height: frame.width }
    : { width: frame.width, height: frame.height };
  return scaledSize(upright, scale);
}
