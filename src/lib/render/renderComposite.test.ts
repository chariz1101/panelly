import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "@/lib/geometry/layouts";
import type { Ctx2D, PanelSource } from "@/lib/render/drawPanel";
import { renderComposite } from "@/lib/render/renderComposite";
import type { Panel } from "@/types";

const panels: Panel[] = DEFAULT_LAYOUT.panels.map(({ rect }, i) => ({
  id: `p${i}`,
  rect,
  media: null,
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
}));

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
    fillRect: rec("fillRect"),
    set fillStyle(v: string) {
      calls.push(["fillStyle", v]);
    },
  } as unknown as Ctx2D;
  return { ctx, calls };
}

const bitmap = (width: number, height: number) => ({ width, height }) as unknown as PanelSource;

describe("renderComposite", () => {
  it("fills the background over the whole output before drawing panels", () => {
    const { ctx, calls } = mockCtx();
    renderComposite(ctx, { layoutId: DEFAULT_LAYOUT.id, panels }, new Map());
    expect(calls).toEqual([
      ["save"],
      ["fillStyle", DEFAULT_LAYOUT.backgroundColor],
      ["fillRect", 0, 0, 1080, 1920],
      ["restore"],
    ]);
  });

  it("draws only panels that have a source, in panel order", () => {
    const { ctx, calls } = mockCtx();
    const a = bitmap(1080, 634);
    const c = bitmap(1080, 634);
    renderComposite(
      ctx,
      { layoutId: DEFAULT_LAYOUT.id, panels },
      new Map([
        ["p2", c],
        ["p0", a],
      ]),
    );
    const draws = calls.filter(([n]) => n === "drawImage");
    expect(draws.map((d) => d[1])).toEqual([a, c]);
    const { x, y, w, h } = panels[0]!.rect;
    expect(draws[0]?.slice(6)).toEqual([x, y, w, h]);
  });

  it("falls back to the default background for an unknown layout", () => {
    const { ctx, calls } = mockCtx();
    renderComposite(ctx, { layoutId: "nope", panels }, new Map());
    expect(calls[1]).toEqual(["fillStyle", "#000"]);
  });
});
