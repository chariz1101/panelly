import type { Ctx2D } from "@/lib/render/drawPanel";
import type { Panel, Rect } from "@/types";

export const PLACEHOLDER_FILL = "#1c1c1e";
export const PLACEHOLDER_PLUS = "#8e8e93";

/** Plus-sign geometry for a panel: arm length and thickness, in output pixels. */
export function plusMetrics(rect: Rect): { size: number; thickness: number } {
  const size = Math.round(Math.min(rect.w, rect.h) * 0.25);
  return { size, thickness: Math.max(2, Math.round(size / 8)) };
}

/**
 * Draw the empty-panel hint: a dim fill with a centred "+". Preview only (the
 * export never draws it). Drawn with rectangles, so no fonts are needed.
 */
export function drawPlaceholder(ctx: Ctx2D, rect: Rect): void {
  const { size, thickness } = plusMetrics(rect);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;

  ctx.save();
  ctx.fillStyle = PLACEHOLDER_FILL;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = PLACEHOLDER_PLUS;
  ctx.fillRect(cx - size / 2, cy - thickness / 2, size, thickness);
  ctx.fillRect(cx - thickness / 2, cy - size / 2, thickness, size);
  ctx.restore();
}

/** Placeholders for every panel that has no media. */
export function drawPlaceholders(ctx: Ctx2D, panels: readonly Panel[]): void {
  for (const panel of panels) if (!panel.media) drawPlaceholder(ctx, panel.rect);
}
