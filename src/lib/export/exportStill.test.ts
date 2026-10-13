import { describe, expect, it, vi } from "vitest";
import type { PanelSource } from "@/lib/render/drawPanel";
import { exportStill, isStillProject, type StillSurface } from "@/lib/export/exportStill";
import { getLayout } from "@/lib/geometry/layouts";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import type { Panel, PanelMedia } from "@/types";

const media = (kind: "image" | "video"): PanelMedia => ({
  kind,
  file: new File([""], "a"),
  objectUrl: "blob:a",
  naturalWidth: 100,
  naturalHeight: 200,
  durationMs: 0,
  muted: true,
});

const layout = getLayout("3-stacked")!;
const panels = (kinds: (("image" | "video") | null)[]): Panel[] =>
  layout.panels.map(({ rect }, i) => ({
    id: `panel-${i}`,
    rect,
    media: kinds[i] ? media(kinds[i]!) : null,
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
  }));

function fakeSurface() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: "",
  };
  const blob = new Blob(["png"], { type: "image/png" });
  const surface = { ctx, toPngBlob: vi.fn().mockResolvedValue(blob) };
  return { surface: surface as unknown as StillSurface, ctx, blob };
}

describe("exportStill", () => {
  it("detects still projects", () => {
    expect(isStillProject({ panels: panels(["image", null, "image"]) })).toBe(true);
    expect(isStillProject({ panels: panels([null, null, null]) })).toBe(true);
    expect(isStillProject({ panels: panels(["image", "video", null]) })).toBe(false);
  });

  it("renders the full 1080x1920 composite and returns the PNG blob", async () => {
    const { surface, ctx, blob } = fakeSurface();
    const img = { naturalWidth: 100, naturalHeight: 200, width: 100, height: 200 };
    const sources = new Map([["panel-0", img as unknown as PanelSource]]);
    const out = await exportStill(
      { layoutId: layout.id, panels: panels(["image", null, null]) },
      sources,
      surface,
    );
    expect(out).toBe(blob);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("refuses projects that contain a video", async () => {
    const { surface } = fakeSurface();
    await expect(
      exportStill(
        { layoutId: layout.id, panels: panels(["video", null, null]) },
        new Map(),
        surface,
      ),
    ).rejects.toThrow(/MP4/);
  });
});
