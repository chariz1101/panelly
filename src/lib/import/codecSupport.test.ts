import { describe, expect, it } from "vitest";
import { UNSUPPORTED_VIDEO_MESSAGE, codecSupportMessage } from "./codecSupport";

describe("codecSupportMessage", () => {
  it("returns null when the decoder supports the codec", () => {
    expect(codecSupportMessage("avc1.64001f", true)).toBeNull();
  });

  it("returns the SPEC §5.5 message when unsupported", () => {
    expect(codecSupportMessage("hvc1.1.6.L93.B0", false)).toBe(UNSUPPORTED_VIDEO_MESSAGE);
    expect(UNSUPPORTED_VIDEO_MESSAGE).toBe(
      "This video format isn't supported in your browser. Try re-saving it, or use a different clip.",
    );
  });

  it("never fails silently when the codec or verdict is unknown", () => {
    expect(codecSupportMessage(null, true)).toBe(UNSUPPORTED_VIDEO_MESSAGE);
    expect(codecSupportMessage("avc1.64001f", undefined)).toBe(UNSUPPORTED_VIDEO_MESSAGE);
  });
});
