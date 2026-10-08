import type { Layout, Rect } from "@/types";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "./output";

/**
 * Gap between stacked panels, in output pixels.
 *
 * SPEC §3 states 8, but its example rects (634 px tall, starting at 0/643/1286)
 * leave 9 px. We keep 8 and derive the rects from it so the two can't disagree.
 */
export const GAP_PX = 8;

export const BACKGROUND_COLOR = "#000";

/**
 * Stack `count` full-width panels top to bottom, separated by exactly `gapPx`,
 * spanning the full output height. Leftover pixels from integer division go
 * one each to the first panels, so every rect sits on whole pixels.
 */
export function stackedRects(count: number, gapPx: number = GAP_PX): Rect[] {
  const available = OUTPUT_HEIGHT - gapPx * (count - 1);
  const base = Math.floor(available / count);
  const extra = available - base * count;

  const rects: Rect[] = [];
  let y = 0;
  for (let i = 0; i < count; i++) {
    const h = base + (i < extra ? 1 : 0);
    rects.push({ x: 0, y, w: OUTPUT_WIDTH, h });
    y += h + gapPx;
  }
  return rects;
}

function stackedLayout(count: number): Layout {
  return {
    id: `${count}-stacked`,
    name: `${count} panels`,
    panels: stackedRects(count).map((rect) => ({ rect })),
    gapPx: GAP_PX,
    backgroundColor: BACKGROUND_COLOR,
  };
}

/** The 3-panel layout (SPEC §1). */
export const DEFAULT_LAYOUT: Layout = stackedLayout(3);

export const LAYOUTS: readonly Layout[] = [DEFAULT_LAYOUT, stackedLayout(2), stackedLayout(4)];

export function getLayout(id: string): Layout | undefined {
  return LAYOUTS.find((l) => l.id === id);
}
