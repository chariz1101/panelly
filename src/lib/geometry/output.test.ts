import { describe, expect, it } from "vitest";
import { frameCount, MAX_DURATION_MS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";

describe("output space", () => {
  it("is 9:16 portrait", () => {
    expect(OUTPUT_WIDTH / OUTPUT_HEIGHT).toBeCloseTo(9 / 16);
  });
});

describe("frameCount", () => {
  it("renders 30 frames per second", () => {
    expect(frameCount(1000)).toBe(30);
    expect(frameCount(6000)).toBe(180);
  });

  it("caps at 15 seconds", () => {
    expect(frameCount(MAX_DURATION_MS)).toBe(450);
    expect(frameCount(20_000)).toBe(450);
  });

  it("rounds partial frames up and never goes negative", () => {
    expect(frameCount(1)).toBe(1);
    expect(frameCount(-5)).toBe(0);
  });
});
