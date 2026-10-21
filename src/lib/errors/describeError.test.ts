import { describe, expect, it } from "vitest";
import {
  DECODE_FAILED_MESSAGE,
  ENCODER_FAILED_MESSAGE,
  EXPORT_FAILED_MESSAGE,
  OUT_OF_MEMORY_MESSAGE,
  describeExportError,
} from "@/lib/errors/describeError";
import { UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/import/codecSupport";

describe("describeExportError", () => {
  it("passes the unsupported-codec message through", () => {
    expect(describeExportError(new Error(UNSUPPORTED_VIDEO_MESSAGE))).toBe(
      UNSUPPORTED_VIDEO_MESSAGE,
    );
  });

  it("maps memory failures", () => {
    expect(describeExportError(new RangeError("Array buffer allocation failed"))).toBe(
      OUT_OF_MEMORY_MESSAGE,
    );
    expect(describeExportError("Out of memory")).toBe(OUT_OF_MEMORY_MESSAGE);
  });

  it("maps decode failures", () => {
    expect(describeExportError(new Error("The video produced no frames."))).toBe(
      DECODE_FAILED_MESSAGE,
    );
    expect(describeExportError("Decoding error.")).toBe(DECODE_FAILED_MESSAGE);
  });

  it("maps encoder failures", () => {
    expect(describeExportError(new Error("Encoder error: bad config"))).toBe(
      ENCODER_FAILED_MESSAGE,
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(describeExportError(new Error("boom"))).toBe(EXPORT_FAILED_MESSAGE);
    expect(describeExportError(undefined)).toBe(EXPORT_FAILED_MESSAGE);
  });
});
