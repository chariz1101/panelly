import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import type { Ctx2D } from "@/lib/render/drawPanel";
import {
  renderComposite,
  type CompositeProject,
  type PanelSources,
} from "@/lib/render/renderComposite";

/** True when no panel holds a video, so the project exports as a PNG (SPEC §6.4). */
export function isStillProject(project: Pick<CompositeProject, "panels">): boolean {
  return !project.panels.some((p) => p.media?.kind === "video");
}

/** A 1080×1920 surface that can be drawn on and encoded to a PNG blob. */
export interface StillSurface {
  ctx: Ctx2D;
  toPngBlob: () => Promise<Blob>;
}

/** Prefers `OffscreenCanvas`; falls back to a detached `<canvas>` (older Safari). */
export function createStillSurface(): StillSurface {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
    const ctx = canvas.getContext("2d");
    if (ctx) return { ctx, toPngBlob: () => canvas.convertToBlob({ type: "image/png" }) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't create a canvas to export the image.");
  return {
    ctx,
    toPngBlob: () =>
      new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the PNG."))),
          "image/png",
        ),
      ),
  };
}

/**
 * Render the project with the same `renderComposite` the preview uses and
 * encode it as a 1080×1920 PNG (SPEC §6.4).
 */
export async function exportStill(
  project: CompositeProject,
  sources: PanelSources,
  surface: StillSurface = createStillSurface(),
): Promise<Blob> {
  if (!isStillProject(project)) throw new Error("Projects with videos export as MP4, not PNG.");
  renderComposite(surface.ctx, project, sources);
  return surface.toPngBlob();
}
