import { describe, expect, it } from "vitest";
import { isWithinWindow, rotationFromMatrix, toMicroseconds } from "./demuxMath";

const fixed = (n: number) => Math.round(n * 0x10000);

describe("toMicroseconds", () => {
  it("converts timescale ticks to microseconds", () => {
    expect(toMicroseconds(15360, 30720)).toBe(500_000);
    expect(toMicroseconds(1001, 30000)).toBe(33_367);
    expect(toMicroseconds(0, 600)).toBe(0);
  });
});

describe("isWithinWindow", () => {
  it("keeps samples decoded before the cut and drops the rest", () => {
    expect(isWithinWindow(0, 600, 15_000)).toBe(true);
    expect(isWithinWindow(8999, 600, 15_000)).toBe(true);
    expect(isWithinWindow(9000, 600, 15_000)).toBe(false);
    expect(isWithinWindow(20 * 600, 600, 15_000)).toBe(false);
  });
});

describe("rotationFromMatrix", () => {
  it("reads the identity as no rotation", () => {
    expect(rotationFromMatrix([fixed(1), 0, 0, 0, fixed(1), 0, 0, 0, 0x40000000])).toBe(0);
  });

  it("reads the common phone rotations", () => {
    expect(rotationFromMatrix([0, fixed(1), 0, fixed(-1), 0, 0, 0, 0, 0x40000000])).toBe(90);
    expect(rotationFromMatrix([fixed(-1), 0, 0, 0, fixed(-1), 0, 0, 0, 0x40000000])).toBe(180);
    expect(rotationFromMatrix([0, fixed(-1), 0, fixed(1), 0, 0, 0, 0, 0x40000000])).toBe(270);
  });

  it("treats a missing matrix as no rotation", () => {
    expect(rotationFromMatrix([])).toBe(0);
  });
});
