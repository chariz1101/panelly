import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the work's result when it finishes in time", async () => {
    const fallback = vi.fn(() => "fallback");
    const result = withTimeout(Promise.resolve("work"), 1000, fallback);
    await expect(result).resolves.toBe("work");
    await vi.advanceTimersByTimeAsync(1000);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("passes on the work's error when it fails in time", async () => {
    const result = withTimeout(Promise.reject(new Error("bad")), 1000, () => "fallback");
    await expect(result).rejects.toThrow("bad");
  });

  it("uses the fallback when the work never settles", async () => {
    const result = withTimeout(new Promise<string>(() => {}), 1000, () => "fallback");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe("fallback");
  });

  it("passes on a fallback error", async () => {
    const result = withTimeout(new Promise<string>(() => {}), 1000, () => {
      throw new Error("still bad");
    });
    const check = expect(result).rejects.toThrow("still bad");
    await vi.advanceTimersByTimeAsync(1000);
    await check;
  });
});
