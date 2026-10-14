import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_VIDEO_DIMENSION,
  validateFileSize,
  validateVideoDimensions,
} from "./validate";

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

describe("validateVideoDimensions", () => {
  it("accepts videos up to and including 4096 px on each side", () => {
    expect(validateVideoDimensions({ width: 1080, height: 1920 })).toBeNull();
    expect(
      validateVideoDimensions({ width: MAX_VIDEO_DIMENSION, height: MAX_VIDEO_DIMENSION }),
    ).toBeNull();
  });

  it("rejects a video that is too wide or too tall", () => {
    expect(validateVideoDimensions({ width: 4097, height: 100 })).toContain("too large");
    expect(validateVideoDimensions({ width: 100, height: 4097 })).toContain("4096 px");
  });
});
