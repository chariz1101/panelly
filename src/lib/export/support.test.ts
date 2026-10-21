import { describe, expect, it } from "vitest";
import {
  exportModeFor,
  extensionForMime,
  hasWebCodecs,
  pickRecorderMime,
} from "@/lib/export/support";

describe("hasWebCodecs", () => {
  it("needs both VideoEncoder and VideoDecoder", () => {
    expect(hasWebCodecs({ VideoEncoder: 1, VideoDecoder: 1 })).toBe(true);
    expect(hasWebCodecs({ VideoEncoder: 1 })).toBe(false);
    expect(hasWebCodecs({ VideoDecoder: 1 })).toBe(false);
    expect(hasWebCodecs({})).toBe(false);
  });
});

describe("exportModeFor", () => {
  it("is limited without WebCodecs", () => {
    expect(exportModeFor({})).toBe("limited");
    expect(exportModeFor({ VideoEncoder: 1, VideoDecoder: 1 })).toBe("full");
  });
});

describe("pickRecorderMime", () => {
  it("prefers MP4, then VP9, VP8, plain WebM", () => {
    expect(pickRecorderMime(() => true)).toBe("video/mp4");
    expect(pickRecorderMime((t) => t.startsWith("video/webm"))).toBe("video/webm;codecs=vp9");
    expect(pickRecorderMime((t) => t === "video/webm")).toBe("video/webm");
  });
  it("returns null when nothing is supported", () => {
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe("extensionForMime", () => {
  it("maps blob types to extensions", () => {
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("video/webm")).toBe("webm");
  });
});
