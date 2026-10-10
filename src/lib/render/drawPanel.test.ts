import { describe, expect, it } from "vitest";
import { coverFitCrop } from "@/lib/geometry/coverFit";
import { drawPanel, type Ctx2D, type PanelSource } from "@/lib/render/drawPanel";
import type { Panel } from "@/types";

const panel: Panel = {
  id: "p1",
  rect: { x: 0, y: 643, w: 1080, h: 634 },
  media: null,
  transform: { scale: 2, offsetX: 0.5, offsetY: -0.25 },
};

function mockCtx() {
  const calls: Array<[string, ...unknown[]]> = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const ctx = {
    save: rec("save"),
    restore: rec("restore"),
    beginPath: rec("beginPath"),
    rect: rec("rect"),
    clip: rec("clip"),
    drawImage: rec("drawImage"),
  } as unknown as Ctx2D;
  return { ctx, calls };
}

// Plain objects stand in for ImageBitmap (width/height), the fallback branch.
const bitmap = (width: number, height: number) => ({ width, height }) as unknown as PanelSource;

describe("drawPanel", () => {
  it("clips to the panel rect and draws the cover-fit crop into it", () => {
    const { ctx, calls } = mockCtx();
    const src = bitmap(1000, 2000);
    drawPanel(ctx, panel, src);

    const c = coverFitCrop(1000, 2000, panel.rect, panel.transform);
    expect(calls).toEqual([
      ["save"],
      ["beginPath"],
      ["rect", 0, 643, 1080, 634],
      ["clip"],
      ["drawImage", src, c.x, c.y, c.w, c.h, 0, 643, 1080, 634],
      ["restore"],
    ]);
  });

  it("draws nothing for a source with no size yet", () => {
    const { ctx, calls } = mockCtx();
    drawPanel(ctx, panel, bitmap(0, 0));
    expect(calls).toEqual([]);
  });
});
