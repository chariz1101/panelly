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
