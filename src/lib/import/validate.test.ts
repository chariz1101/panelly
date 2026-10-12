import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, validateFileSize } from "./validate";

describe("validateFileSize", () => {
  it("accepts files up to and including 200 MB", () => {
    expect(validateFileSize({ size: 0 })).toBeNull();
    expect(validateFileSize({ size: MAX_FILE_BYTES })).toBeNull();
  });

  it("rejects larger files with a clear message", () => {
    const message = validateFileSize({ size: MAX_FILE_BYTES + 1 });
    expect(message).toContain("too big");
    expect(message).toContain("200 MB");
  });
});
