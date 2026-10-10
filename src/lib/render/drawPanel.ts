import { coverFitCrop } from "@/lib/geometry/coverFit";
import type { Panel } from "@/types";

/** Anything `drawImage` can paint into a panel (SPEC §10). */
export type PanelSource = HTMLImageElement | ImageBitmap | HTMLVideoElement | VideoFrame;

/** Either kind of 2D context, so preview and export share this code. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Intrinsic pixel size of a source, as the browser will draw it. */
export function sourceSize(source: PanelSource): { w: number; h: number } {
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  if (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) {
    return { w: source.displayWidth, h: source.displayHeight };
  }
  const bitmap = source as ImageBitmap;
  return { w: bitmap.width, h: bitmap.height };
}

/**
 * The one compositing function shared by the preview and the export
 * (SPEC §10). Clips to `panel.rect` and draws `source` with the cover-fit
 * crop for `panel.transform`.
 *
 * The crop is computed from the source's own size, not `panel.media`, so a
 * downscaled decode frames identically to the full-size original.
 */
export function drawPanel(ctx: Ctx2D, panel: Panel, source: PanelSource): void {
  const { w: sw, h: sh } = sourceSize(source);
  if (sw <= 0 || sh <= 0) return;

  const { rect, transform } = panel;
  const crop = coverFitCrop(sw, sh, rect, transform);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}
