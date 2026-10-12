import { coverFitCrop } from "@/lib/geometry/coverFit";
import type { Rect, Transform } from "@/types";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Apply a drag of (`dx`, `dy`) output-space pixels to `transform` (SPEC §1).
 * The media follows the pointer, so the crop window moves the opposite way.
 * Offsets are normalized to -1..1 and clamped, so the panel never shows empty
 * space. On an axis where the crop spans the whole media there is nothing to
 * pan, and that offset is left unchanged.
 */
export function dragTransform(
  mediaWidth: number,
  mediaHeight: number,
  panelRect: Pick<Rect, "w" | "h">,
  transform: Transform,
  dx: number,
  dy: number,
): Transform {
  const crop = coverFitCrop(mediaWidth, mediaHeight, panelRect, transform);
  // Source pixels per output pixel at the current zoom.
  const srcPerPxX = crop.w / panelRect.w;
  const srcPerPxY = crop.h / panelRect.h;
  const rangeX = (mediaWidth - crop.w) / 2;
  const rangeY = (mediaHeight - crop.h) / 2;

  const shift = (offset: number, range: number, deltaSrc: number) =>
    range > 1e-9 ? clamp(offset - deltaSrc / range, -1, 1) : clamp(offset, -1, 1);

  return {
    scale: Math.max(1, transform.scale),
    offsetX: shift(transform.offsetX, rangeX, dx * srcPerPxX),
    offsetY: shift(transform.offsetY, rangeY, dy * srcPerPxY),
  };
}
