import type { Rect, Transform } from "@/types";

/** Clamp `n` into the inclusive range [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Cover-fit crop (SPEC §3): returns the rect of the source media (in source
 * pixels) that should be drawn into `panelRect`.
 *
 * At `scale = 1` the crop is the largest region of the media with the panel's
 * aspect ratio. Higher scales shrink the crop around the same centre.
 * `offsetX/offsetY` (-1..1) move the crop window's centre from the media
 * centre to the media edge, so the crop always stays inside the media and the
 * panel never shows empty space. Out-of-range inputs are clamped
 * (`scale` to >= 1, offsets to -1..1).
 */
export function coverFitCrop(
  mediaWidth: number,
  mediaHeight: number,
  panelRect: Pick<Rect, "w" | "h">,
  transform: Transform,
): Rect {
  const scale = Math.max(1, transform.scale);
  const offsetX = clamp(transform.offsetX, -1, 1);
  const offsetY = clamp(transform.offsetY, -1, 1);

  // Source pixels per panel pixel at scale 1: the smaller ratio fills the panel.
  const base = Math.min(mediaWidth / panelRect.w, mediaHeight / panelRect.h);
  const w = (panelRect.w * base) / scale;
  const h = (panelRect.h * base) / scale;

  return {
    x: (mediaWidth - w) / 2 + (offsetX * (mediaWidth - w)) / 2,
    y: (mediaHeight - h) / 2 + (offsetY * (mediaHeight - h)) / 2,
    w,
    h,
  };
}
