import type { Transform } from "@/types";

/** Zoom never goes below cover-fit (SPEC §3: `scale >= 1`). */
export const MIN_SCALE = 1;
export const MAX_SCALE = 5;

/** Fractional zoom change per wheel pixel (`deltaY` in pixels). */
const WHEEL_SENSITIVITY = 0.002;

/** Clamp a zoom scale into [MIN_SCALE, MAX_SCALE]; non-finite input gives MIN_SCALE. */
export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** New scale after a wheel event. Scrolling up (negative `deltaY`) zooms in. */
export function wheelScale(scale: number, deltaY: number): number {
  return clampScale(scale * Math.exp(-deltaY * WHEEL_SENSITIVITY));
}

/** New scale for a pinch: the start scale times the ratio of finger distances. */
export function pinchScale(startScale: number, startDistance: number, distance: number): number {
  if (!(startDistance > 0)) return clampScale(startScale);
  return clampScale(startScale * (distance / startDistance));
}

/** The same framing at a new zoom. Offsets are normalized, so they stay valid. */
export function withScale(transform: Transform, scale: number): Transform {
  return { ...transform, scale: clampScale(scale) };
}
