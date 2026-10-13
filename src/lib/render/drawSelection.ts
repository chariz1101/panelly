import type { Ctx2D } from "@/lib/render/drawPanel";
import type { Panel } from "@/types";

export const SELECTION_COLOR = "#0a84ff";
/** Outline thickness in output pixels (roughly 3 CSS px on a phone). */
export const SELECTION_WIDTH = 10;

/** Highlight the selected panel with an inset outline. Preview only. */
export function drawSelection(ctx: Ctx2D, panels: readonly Panel[], selectedId: string | null) {
  const panel = panels.find((p) => p.id === selectedId);
  if (!panel?.media) return;
  const { x, y, w, h } = panel.rect;
  const inset = SELECTION_WIDTH / 2;

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = SELECTION_WIDTH;
  ctx.strokeRect(x + inset, y + inset, w - SELECTION_WIDTH, h - SELECTION_WIDTH);
  ctx.restore();
}
