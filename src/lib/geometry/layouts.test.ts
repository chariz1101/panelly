import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, GAP_PX, LAYOUTS, getLayout, stackedRects } from "@/lib/geometry/layouts";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";

describe("layout presets", () => {
  it("offers 2, 3 and 4 panels with 3 as the default", () => {
    expect(LAYOUTS.map((l) => l.panels.length).sort()).toEqual([2, 3, 4]);
    expect(DEFAULT_LAYOUT.panels).toHaveLength(3);
    expect(LAYOUTS[0]).toBe(DEFAULT_LAYOUT);
  });

  it("uses unique ids and finds layouts by id", () => {
    expect(new Set(LAYOUTS.map((l) => l.id)).size).toBe(LAYOUTS.length);
    for (const l of LAYOUTS) expect(getLayout(l.id)).toBe(l);
    expect(getLayout("nope")).toBeUndefined();
  });

  it("uses a black background and an 8 px gap", () => {
    expect(GAP_PX).toBe(8);
    for (const l of LAYOUTS) {
      expect(l.gapPx).toBe(8);
      expect(l.backgroundColor).toBe("#000");
    }
  });

  it.each(LAYOUTS.map((l) => [l.id, l] as const))(
    "%s: rects are whole-pixel, full width, in bounds, and separated by exactly gapPx",
    (_id, layout) => {
      const rects = layout.panels.map((p) => p.rect);
      expect(rects[0]?.y).toBe(0);
      const last = rects[rects.length - 1];
      expect((last?.y ?? 0) + (last?.h ?? 0)).toBe(OUTPUT_HEIGHT);
      rects.forEach((r, i) => {
        const prev = rects[i - 1];
        expect(r.x).toBe(0);
        expect(r.w).toBe(OUTPUT_WIDTH);
        for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
        if (prev) expect(r.y - (prev.y + prev.h)).toBe(layout.gapPx);
      });
    },
  );

  it("keeps panel heights within 1 px of each other", () => {
    for (const l of LAYOUTS) {
      const hs = l.panels.map((p) => p.rect.h);
      expect(Math.max(...hs) - Math.min(...hs)).toBeLessThanOrEqual(1);
    }
  });

  it("lays out the 3-panel default as 635/635/634 with 8 px gaps", () => {
    expect(stackedRects(3)).toEqual([
      { x: 0, y: 0, w: 1080, h: 635 },
      { x: 0, y: 643, w: 1080, h: 635 },
      { x: 0, y: 1286, w: 1080, h: 634 },
    ]);
  });
});
