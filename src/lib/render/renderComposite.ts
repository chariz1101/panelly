import { BACKGROUND_COLOR, getLayout } from "@/lib/geometry/layouts";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import { drawPanel, type Ctx2D, type PanelSource } from "@/lib/render/drawPanel";
import type { Project } from "@/types";

/** The part of a `Project` the renderer needs. */
export type CompositeProject = Pick<Project, "layoutId" | "panels">;

/** Current drawable for each panel, keyed by panel id. Panels without one stay empty. */
export type PanelSources = ReadonlyMap<string, PanelSource>;

/**
 * Render one full 1080×1920 frame: fill the layout's background colour, then
 * `drawPanel` each panel that has a source. Shared by the preview and the
 * export so both frame identically (SPEC §10).
 */
export function renderComposite(
  ctx: Ctx2D,
  project: CompositeProject,
  sources: PanelSources,
): void {
  const background = getLayout(project.layoutId)?.backgroundColor ?? BACKGROUND_COLOR;

  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  ctx.restore();

  for (const panel of project.panels) {
    const source = sources.get(panel.id);
    if (source) drawPanel(ctx, panel, source);
  }
}
