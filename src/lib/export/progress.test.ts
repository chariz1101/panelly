import { describe, expect, it } from "vitest";
import { progressFraction } from "./protocol";

describe("progressFraction", () => {
  it("is frames encoded over frames total", () => {
    expect(progressFraction(0, 450)).toBe(0);
    expect(progressFraction(225, 450)).toBe(0.5);
    expect(progressFraction(450, 450)).toBe(1);
  });

  it("stays within 0..1 and handles an empty job", () => {
    expect(progressFraction(500, 450)).toBe(1);
    expect(progressFraction(-1, 450)).toBe(0);
    expect(progressFraction(0, 0)).toBe(0);
  });
});
