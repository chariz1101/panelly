import { describe, expect, it } from "vitest";
import { clientToOutput, panelAtPoint } from "./hitTest";
import { DEFAULT_LAYOUT } from "./layouts";
import type { Panel } from "@/types";

const panels: Panel[] = DEFAULT_LAYOUT.panels.map(({ rect }, i) => ({
  id: `panel-${i}`,
  rect,
  media: null,
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
}));

describe("clientToOutput", () => {
  it("scales CSS pixels up to the output space", () => {
    const box = { left: 10, top: 20, width: 270, height: 480 };
    expect(clientToOutput(10 + 135, 20 + 240, box)).toEqual({ x: 540, y: 960 });
  });

  it("returns null for a zero-sized box", () => {
    expect(clientToOutput(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });
});

describe("panelAtPoint", () => {
  it("finds the panel containing the point", () => {
    expect(panelAtPoint(panels, { x: 540, y: 10 })?.id).toBe("panel-0");
    expect(panelAtPoint(panels, { x: 540, y: 960 })?.id).toBe("panel-1");
    expect(panelAtPoint(panels, { x: 540, y: 1900 })?.id).toBe("panel-2");
  });

  it("returns null in a gap or outside the canvas", () => {
    const first = panels[0]!.rect;
    const gapY = first.y + first.h + 1;
    expect(panelAtPoint(panels, { x: 540, y: gapY })).toBeNull();
    expect(panelAtPoint(panels, { x: -1, y: 10 })).toBeNull();
  });
});
