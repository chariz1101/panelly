import { describe, expect, it } from "vitest";
import { decodeScaleFor, scaledSize } from "./decodeScale";

describe("decodeScaleFor", () => {
  it("keeps videos at or under 1080 on the shorter side unscaled", () => {
    expect(decodeScaleFor({ width: 1080, height: 1920 })).toBe(1);
    expect(decodeScaleFor({ width: 640, height: 360 })).toBe(1);
  });

  it("scales 4K down so the shorter side is 1080", () => {
    expect(decodeScaleFor({ width: 3840, height: 2160 })).toBe(0.5);
    expect(decodeScaleFor({ width: 2160, height: 3840 })).toBe(0.5);
  });

  it("uses the shorter side, not the longer one", () => {
    expect(decodeScaleFor({ width: 4096, height: 1080 })).toBe(1);
    expect(decodeScaleFor({ width: 1440, height: 2560 })).toBeCloseTo(0.75);
  });
});

describe("scaledSize", () => {
  it("returns the same size at scale 1", () => {
    expect(scaledSize({ width: 1081, height: 1921 }, 1)).toEqual({ width: 1081, height: 1921 });
  });

  it("scales and rounds to even dimensions", () => {
    expect(scaledSize({ width: 3840, height: 2160 }, 0.5)).toEqual({ width: 1920, height: 1080 });
    const { width, height } = scaledSize({ width: 1442, height: 2562 }, 1080 / 1442);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });
});
