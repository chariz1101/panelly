import { describe, expect, it } from "vitest";
import { coverFitCrop } from "@/lib/geometry/coverFit";
import { dragTransform } from "@/lib/geometry/drag";

const panel = { w: 1080, h: 600 };
const identity = { scale: 1, offsetX: 0, offsetY: 0 };

describe("dragTransform", () => {
  it("moves the media with the pointer (crop moves opposite)", () => {
    // 2160x600 media in a 1080x600 panel: x range is 540 source px each side.
    const t = dragTransform(2160, 600, panel, identity, 100, 0);
    const before = coverFitCrop(2160, 600, panel, identity);
    const after = coverFitCrop(2160, 600, panel, t);
    expect(after.x).toBeCloseTo(before.x - 100);
    expect(t.offsetX).toBeLessThan(0);
  });

  it("clamps offsets to -1..1", () => {
    expect(dragTransform(2160, 600, panel, identity, 100000, 0).offsetX).toBe(-1);
    expect(dragTransform(2160, 600, panel, identity, -100000, 0).offsetX).toBe(1);
  });

  it("leaves an axis alone when the crop fills the media on it", () => {
    const t = dragTransform(2160, 600, panel, identity, 0, 300);
    expect(t.offsetY).toBe(0);
  });

  it("pans more finely when zoomed in", () => {
    const zoomed = { scale: 2, offsetX: 0, offsetY: 0 };
    const t = dragTransform(2160, 600, panel, zoomed, 50, 25);
    const crop = coverFitCrop(2160, 600, panel, t);
    const start = coverFitCrop(2160, 600, panel, zoomed);
    expect(crop.x).toBeCloseTo(start.x - 25);
    expect(crop.y).toBeCloseTo(start.y - 12.5);
  });

  it("keeps the scale, flooring it at 1", () => {
    expect(dragTransform(2160, 600, panel, { ...identity, scale: 3 }, 1, 1).scale).toBe(3);
    expect(dragTransform(2160, 600, panel, { ...identity, scale: 0.5 }, 1, 1).scale).toBe(1);
  });
});
