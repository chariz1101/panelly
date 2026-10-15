import { describe, expect, it } from "vitest";
import { projectDurationMs, sourceTimeFor } from "@/lib/geometry/duration";
import type { Panel, PanelMedia } from "@/types";

function media(kind: "image" | "video", durationMs = 0): PanelMedia {
  return {
    kind,
    file: new File([""], "f"),
    objectUrl: "blob:f",
    naturalWidth: 100,
    naturalHeight: 100,
    durationMs,
    muted: true,
  };
}

const panel = (m: PanelMedia | null): Pick<Panel, "media"> => ({ media: m });

describe("projectDurationMs", () => {
  it("is 0 with no panels, empty panels, or only images", () => {
    expect(projectDurationMs([])).toBe(0);
    expect(projectDurationMs([panel(null), panel(media("image"))])).toBe(0);
  });

  it("is the longest video duration", () => {
    expect(
      projectDurationMs([panel(media("video", 6000)), panel(media("video", 9000)), panel(null)]),
    ).toBe(9000);
  });

  it("caps at 15 seconds", () => {
    expect(projectDurationMs([panel(media("video", 20000)), panel(media("video", 6000))])).toBe(
      15000,
    );
  });

  it("ignores non-finite durations", () => {
    expect(projectDurationMs([panel(media("video", NaN)), panel(media("video", 4000))])).toBe(4000);
  });
});

describe("sourceTimeFor", () => {
  it("is 0 for images and empty panels", () => {
    expect(sourceTimeFor(panel(media("image")), 5000)).toBe(0);
    expect(sourceTimeFor(panel(null), 5000)).toBe(0);
  });

  it("plays a video straight through while inside its duration", () => {
    expect(sourceTimeFor(panel(media("video", 6000)), 0)).toBe(0);
    expect(sourceTimeFor(panel(media("video", 6000)), 4500)).toBe(4500);
  });

  it("loops shorter clips with modulo", () => {
    const p = panel(media("video", 6000));
    expect(sourceTimeFor(p, 6000)).toBe(0);
    expect(sourceTimeFor(p, 13000)).toBe(1000);
  });

  it("uses only the first 15 s of longer clips", () => {
    const p = panel(media("video", 20000));
    expect(sourceTimeFor(p, 14999)).toBe(14999);
    expect(sourceTimeFor(p, 15000)).toBe(0);
  });

  it("is safe for bad input", () => {
    expect(sourceTimeFor(panel(media("video", 0)), 100)).toBe(0);
    expect(sourceTimeFor(panel(media("video", 5000)), -50)).toBe(0);
    expect(sourceTimeFor(panel(media("video", 5000)), NaN)).toBe(0);
  });
});
