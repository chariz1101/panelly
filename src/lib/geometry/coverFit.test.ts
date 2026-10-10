import { describe, expect, it } from "vitest";
import { coverFitCrop } from "@/lib/geometry/coverFit";

const panel = { w: 1080, h: 634 };
const identity = { scale: 1, offsetX: 0, offsetY: 0 };

describe("coverFitCrop", () => {
  it("centres a crop with the panel aspect on a portrait source", () => {
    const c = coverFitCrop(1000, 2000, panel, identity);
    expect(c.w).toBeCloseTo(1000);
    expect(c.h).toBeCloseTo((1000 * 634) / 1080);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo((2000 - c.h) / 2);
  });

  it("crops the sides of a landscape source", () => {
    const c = coverFitCrop(4000, 634, panel, identity);
    expect(c.h).toBeCloseTo(634);
    expect(c.w).toBeCloseTo(1080);
    expect(c.x).toBeCloseTo((4000 - 1080) / 2);
    expect(c.y).toBeCloseTo(0);
  });

  it("uses the whole source when its aspect matches the panel", () => {
    expect(coverFitCrop(540, 317, panel, identity)).toEqual({ x: 0, y: 0, w: 540, h: 317 });
  });

  it("shrinks the crop around the centre when zoomed", () => {
    const base = coverFitCrop(1000, 2000, panel, identity);
    const z = coverFitCrop(1000, 2000, panel, { ...identity, scale: 2 });
    expect(z.w).toBeCloseTo(base.w / 2);
    expect(z.h).toBeCloseTo(base.h / 2);
    expect(z.x + z.w / 2).toBeCloseTo(500);
    expect(z.y + z.h / 2).toBeCloseTo(1000);
  });

  it("moves the crop to the media edges at offset ±1 and never leaves the media", () => {
    for (const scale of [1, 1.5, 4]) {
      for (const ox of [-1, 1]) {
        for (const oy of [-1, 1]) {
          const c = coverFitCrop(1000, 2000, panel, { scale, offsetX: ox, offsetY: oy });
          expect(c.x).toBeGreaterThanOrEqual(-1e-9);
          expect(c.y).toBeGreaterThanOrEqual(-1e-9);
          expect(c.x + c.w).toBeLessThanOrEqual(1000 + 1e-9);
          expect(c.y + c.h).toBeLessThanOrEqual(2000 + 1e-9);
        }
      }
    }
    const left = coverFitCrop(1000, 2000, panel, { scale: 2, offsetX: -1, offsetY: -1 });
    expect(left.x).toBeCloseTo(0);
    expect(left.y).toBeCloseTo(0);
    const right = coverFitCrop(1000, 2000, panel, { scale: 2, offsetX: 1, offsetY: 1 });
    expect(right.x + right.w).toBeCloseTo(1000);
    expect(right.y + right.h).toBeCloseTo(2000);
  });

  it("clamps out-of-range scale and offsets", () => {
    expect(coverFitCrop(1000, 2000, panel, { scale: 0.2, offsetX: 5, offsetY: -9 })).toEqual(
      coverFitCrop(1000, 2000, panel, { scale: 1, offsetX: 1, offsetY: -1 }),
    );
  });
});
