import { describe, expect, it } from "vitest";
import { mediaKindOf } from "./fileKind";

describe("mediaKindOf", () => {
  it("recognises images and videos", () => {
    expect(mediaKindOf({ type: "image/jpeg" })).toBe("image");
    expect(mediaKindOf({ type: "video/quicktime" })).toBe("video");
  });

  it("rejects anything else", () => {
    expect(mediaKindOf({ type: "application/pdf" })).toBeNull();
    expect(mediaKindOf({ type: "" })).toBeNull();
  });
});

describe("mediaKindOf extension fallback", () => {
  it("classifies untyped Android files by extension", () => {
    expect(mediaKindOf({ type: "", name: "VID_001.mp4" })).toBe("video");
    expect(mediaKindOf({ type: "application/octet-stream", name: "IMG.JPG" })).toBe("image");
  });

  it("still rejects unknown files", () => {
    expect(mediaKindOf({ type: "", name: "notes.txt" })).toBeNull();
    expect(mediaKindOf({ type: "text/plain", name: "a.mp4" })).toBeNull();
  });
});
