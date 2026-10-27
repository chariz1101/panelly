import { describe, expect, it } from "vitest";
import { isPastWindow, secondsToMicroseconds } from "./demuxMath";

describe("secondsToMicroseconds", () => {
  it("converts and rounds", () => {
    expect(secondsToMicroseconds(0.5)).toBe(500_000);
    expect(secondsToMicroseconds(1001 / 30000)).toBe(33_367);
    expect(secondsToMicroseconds(0)).toBe(0);
  });
});

describe("isPastWindow", () => {
  it("stops only at a key packet at or after the cut", () => {
    expect(isPastWindow({ type: "key", timestamp: 0 }, 0, 15_000)).toBe(false);
    expect(isPastWindow({ type: "key", timestamp: 14.99 }, 0, 15_000)).toBe(false);
    expect(isPastWindow({ type: "key", timestamp: 15 }, 0, 15_000)).toBe(true);
  });

  it("keeps delta packets past the cut, which frames before it may depend on", () => {
    expect(isPastWindow({ type: "delta", timestamp: 16 }, 0, 15_000)).toBe(false);
  });

  it("measures from the clip's first timestamp", () => {
    expect(isPastWindow({ type: "key", timestamp: 15.5 }, 1, 15_000)).toBe(false);
    expect(isPastWindow({ type: "key", timestamp: 16 }, 1, 15_000)).toBe(true);
  });
});
