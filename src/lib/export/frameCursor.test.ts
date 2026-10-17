import { describe, expect, it } from "vitest";
import {
  frameTimestampUs,
  framesToDrop,
  heldFrameSize,
  pickNearest,
  seekIndex,
} from "./frameCursor";

describe("frameTimestampUs", () => {
  it("steps in 1/30 s and stays an integer", () => {
    expect(frameTimestampUs(0)).toBe(0);
    expect(frameTimestampUs(1)).toBe(33_333);
    expect(frameTimestampUs(3)).toBe(100_000);
    expect(frameTimestampUs(449)).toBe(14_966_667);
  });
});

describe("pickNearest", () => {
  const ts = [0, 40_000, 80_000];

  it("returns the closest timestamp", () => {
    expect(pickNearest(ts, 10_000)).toBe(0);
    expect(pickNearest(ts, 30_000)).toBe(1);
    expect(pickNearest(ts, 1_000_000)).toBe(2);
    expect(pickNearest(ts, -5)).toBe(0);
  });

  it("prefers the earlier frame on a tie and handles empty input", () => {
    expect(pickNearest(ts, 20_000)).toBe(0);
    expect(pickNearest([], 0)).toBe(-1);
  });
});

describe("framesToDrop", () => {
  it("keeps the last frame at or before the target plus everything ahead", () => {
    const ts = [0, 40_000, 80_000, 120_000];
    expect(framesToDrop(ts, 0)).toBe(0);
    expect(framesToDrop(ts, 39_999)).toBe(0);
    expect(framesToDrop(ts, 40_000)).toBe(1);
    expect(framesToDrop(ts, 100_000)).toBe(2);
    expect(framesToDrop(ts, 500_000)).toBe(3);
  });

  it("drops nothing when empty or when every frame is ahead", () => {
    expect(framesToDrop([], 10)).toBe(0);
    expect(framesToDrop([50, 90], 10)).toBe(0);
  });
});

describe("seekIndex", () => {
  const chunks = [
    { type: "key", timestamp: 0 },
    { type: "delta", timestamp: 40_000 },
    { type: "key", timestamp: 80_000 },
    { type: "delta", timestamp: 120_000 },
  ];

  it("starts from the keyframe at the start of the clip when looping", () => {
    expect(seekIndex(chunks, 0)).toBe(0);
  });

  it("uses the last keyframe at or before the target", () => {
    expect(seekIndex(chunks, 100_000)).toBe(2);
    expect(seekIndex(chunks, 79_999)).toBe(0);
  });

  it("falls back to the first keyframe, then to 0", () => {
    expect(seekIndex([{ type: "key", timestamp: 500 }], 0)).toBe(0);
    expect(seekIndex([{ type: "delta", timestamp: 0 }], 0)).toBe(0);
    expect(seekIndex([], 0)).toBe(0);
  });
});

describe("heldFrameSize", () => {
  it("leaves an upright full-size frame alone", () => {
    expect(heldFrameSize({ width: 1080, height: 1920 }, 0, 1)).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("swaps width and height for quarter turns", () => {
    expect(heldFrameSize({ width: 1920, height: 1080 }, 90, 1)).toEqual({
      width: 1080,
      height: 1920,
    });
    expect(heldFrameSize({ width: 1920, height: 1080 }, 180, 1)).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("applies the decode downscale after rotating", () => {
    // 4K landscape recorded for portrait: 3840x2160 rotated 270 -> 2160x3840 -> 1080x1920.
    expect(heldFrameSize({ width: 3840, height: 2160 }, 270, 0.5)).toEqual({
      width: 1080,
      height: 1920,
    });
  });
});
