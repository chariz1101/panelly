import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "@/lib/geometry/layouts";
import type { Ctx2D } from "@/lib/render/drawPanel";
import { drawPlaceholder, drawPlaceholders, plusMetrics } from "@/lib/render/drawPlaceholder";
import type { Panel, PanelMedia } from "@/types";

function mockCtx() {
  const fills: number[][] = [];
  const ctx = {
    save() {},
    restore() {},
    fillStyle: "",
    fillRect: (...a: number[]) => fills.push(a),
  } as unknown as Ctx2D;
  return { ctx, fills };
}

const panels: Panel[] = DEFAULT_LAYOUT.panels.map(({ rect }, i) => ({
  id: `p${i}`,
  rect,
  media: null,
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
}));

describe("drawPlaceholder", () => {
  it("fills the rect and centres a plus inside it", () => {
    const rect = { x: 0, y: 100, w: 1080, h: 600 };
    const { ctx, fills } = mockCtx();
    drawPlaceholder(ctx, rect);
    const { size, thickness } = plusMetrics(rect);

    expect(fills).toHaveLength(3);
    expect(fills[0]).toEqual([0, 100, 1080, 600]);
    expect(fills[1]).toEqual([540 - size / 2, 400 - thickness / 2, size, thickness]);
    expect(fills[2]).toEqual([540 - thickness / 2, 400 - size / 2, thickness, size]);
  });

  it("sizes the plus from the shorter side", () => {
    expect(plusMetrics({ x: 0, y: 0, w: 1080, h: 400 }).size).toBe(100);
  });

  it("only draws for panels without media", () => {
    const [first, second, third] = panels as [Panel, Panel, Panel];
    const filled: Panel = { ...first, media: {} as PanelMedia };
    const { ctx, fills } = mockCtx();
    drawPlaceholders(ctx, [filled, second, third]);
    expect(fills).toHaveLength(6);
    expect(fills[0]?.[1]).toBe(second.rect.y);
  });
});
