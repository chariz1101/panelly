import { describe, expect, it } from "vitest";
import { MAX_SCALE, clampScale, pinchScale, wheelScale, withScale } from "@/lib/geometry/zoom";

describe("clampScale", () => {
  it("keeps scale within 1..MAX_SCALE", () => {
    expect(clampScale(0.3)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(NaN)).toBe(1);
  });
});

describe("wheelScale", () => {
  it("zooms in on negative deltaY and out on positive", () => {
    expect(wheelScale(2, -100)).toBeGreaterThan(2);
    expect(wheelScale(2, 100)).toBeLessThan(2);
  });

  it("never drops below 1 or exceeds the max", () => {
    expect(wheelScale(1, 1000)).toBe(1);
    expect(wheelScale(MAX_SCALE, -1000)).toBe(MAX_SCALE);
  });
});

describe("pinchScale", () => {
  it("scales by the ratio of finger distances", () => {
    expect(pinchScale(1.5, 100, 200)).toBeCloseTo(3);
    expect(pinchScale(2, 200, 100)).toBeCloseTo(1);
  });

  it("clamps and tolerates a zero start distance", () => {
    expect(pinchScale(1, 100, 10)).toBe(1);
    expect(pinchScale(2, 0, 50)).toBe(2);
  });
});

describe("withScale", () => {
  it("changes only the scale", () => {
    expect(withScale({ scale: 1, offsetX: 0.4, offsetY: -0.2 }, 2)).toEqual({
      scale: 2,
      offsetX: 0.4,
      offsetY: -0.2,
    });
  });
});
