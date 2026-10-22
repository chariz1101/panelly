import { describe, expect, it } from "vitest";
import { isEditorSupported, missingEditorFeatures } from "@/lib/export/editorSupport";

const MODERN = {
  createImageBitmap: 1,
  OffscreenCanvas: 1,
  Worker: 1,
  requestAnimationFrame: 1,
};

describe("isEditorSupported", () => {
  it("accepts a browser with every required feature", () => {
    expect(isEditorSupported(MODERN)).toBe(true);
    expect(missingEditorFeatures(MODERN)).toEqual([]);
  });

  it("rejects a browser missing any feature and names it", () => {
    const old: Record<string, unknown> = { ...MODERN };
    delete old.OffscreenCanvas;
    expect(isEditorSupported(old)).toBe(false);
    expect(missingEditorFeatures(old)).toEqual(["canvas rendering"]);
    expect(missingEditorFeatures({})).toHaveLength(4);
  });
});
