import { describe, expect, it } from "vitest";
import type { Ctx2D } from "@/lib/render/drawPanel";
import { drawSelection, SELECTION_WIDTH } from "@/lib/render/drawSelection";
import type { Panel, PanelMedia } from "@/types";

const media = { kind: "image" } as PanelMedia;
const mk = (id: string, m: PanelMedia | null): Panel => ({
  id,
  rect: { x: 0, y: 100, w: 1080, h: 600 },
  media: m,
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
});

function run(panels: Panel[], id: string | null) {
  const strokes: number[][] = [];
  const ctx = {
    save() {},
    restore() {},
    strokeRect: (...a: number[]) => strokes.push(a),
  } as unknown as Ctx2D;
  drawSelection(ctx, panels, id);
  return strokes;
}

describe("drawSelection", () => {
  it("outlines the selected filled panel inside its rect", () => {
    const s = SELECTION_WIDTH;
    expect(run([mk("a", media)], "a")).toEqual([[s / 2, 100 + s / 2, 1080 - s, 600 - s]]);
  });

  it("draws nothing without a selection or for empty panels", () => {
    expect(run([mk("a", media)], null)).toEqual([]);
    expect(run([mk("a", null)], "a")).toEqual([]);
  });
});
