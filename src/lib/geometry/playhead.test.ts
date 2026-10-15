import { describe, expect, it } from "vitest";
import { advancePlayhead, needsResync } from "@/lib/geometry/playhead";

describe("advancePlayhead", () => {
  it("moves forward by the elapsed time", () => {
    expect(advancePlayhead(1000, 16, 6000)).toBe(1016);
  });

  it("wraps at the project duration", () => {
    expect(advancePlayhead(5990, 20, 6000)).toBe(10);
  });

  it("returns 0 when there is nothing to play", () => {
    expect(advancePlayhead(500, 16, 0)).toBe(0);
  });

  it("ignores negative deltas and bad playheads", () => {
    expect(advancePlayhead(500, -50, 6000)).toBe(500);
    expect(advancePlayhead(Number.NaN, 10, 6000)).toBe(10);
  });
});

describe("needsResync", () => {
  it("accepts small drift", () => {
    expect(needsResync(2000, 2100, 6000)).toBe(false);
  });

  it("flags drift beyond the tolerance", () => {
    expect(needsResync(2000, 2500, 6000)).toBe(true);
  });

  it("treats the loop point as close", () => {
    expect(needsResync(5950, 50, 6000)).toBe(false);
    expect(needsResync(50, 5950, 6000)).toBe(false);
  });

  it("still flags large drift across the loop", () => {
    expect(needsResync(3000, 50, 6000)).toBe(true);
  });
});
