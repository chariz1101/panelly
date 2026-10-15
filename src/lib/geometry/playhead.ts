/**
 * Playhead maths for the single preview clock (SPEC §7). Pure, so the
 * `requestAnimationFrame` loop stays a thin shell around it.
 */

/** How far (ms) a playing `<video>` may drift from its target before it is re-seeked. */
export const RESYNC_TOLERANCE_MS = 300;

/** Advance the project playhead by `deltaMs`, wrapping at `durationMs`. */
export function advancePlayhead(playheadMs: number, deltaMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  const next = (Number.isFinite(playheadMs) ? playheadMs : 0) + Math.max(deltaMs, 0);
  return next % durationMs;
}

/**
 * Whether a video at `currentMs` has drifted from `targetMs` enough to need a
 * seek. Distances wrap around the clip length, so a video that is about to
 * loop is not treated as far from a target that has just looped.
 */
export function needsResync(
  currentMs: number,
  targetMs: number,
  clipMs: number,
  toleranceMs: number = RESYNC_TOLERANCE_MS,
): boolean {
  const diff = Math.abs(currentMs - targetMs);
  const wrapped = clipMs > 0 ? Math.min(diff, Math.abs(clipMs - diff)) : diff;
  return wrapped > toleranceMs;
}
