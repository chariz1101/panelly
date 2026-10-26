import type { Panel } from "@/types";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "./output";

export interface Point {
  x: number;
  y: number;
}

/** The on-screen box of the canvas, as from `getBoundingClientRect()`. */
export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Maps a client (CSS pixel) point to the 1080×1920 output space. */
export function clientToOutput(clientX: number, clientY: number, box: ScreenBox): Point | null {
  if (box.width <= 0 || box.height <= 0) return null;
  return {
    x: ((clientX - box.left) / box.width) * OUTPUT_WIDTH,
    y: ((clientY - box.top) / box.height) * OUTPUT_HEIGHT,
  };
}

/** The panel whose rect contains the output-space point, or `null` (e.g. outside the canvas). */
export function panelAtPoint(panels: readonly Panel[], point: Point): Panel | null {
  return (
    panels.find(
      ({ rect }) =>
        point.x >= rect.x &&
        point.x < rect.x + rect.w &&
        point.y >= rect.y &&
        point.y < rect.y + rect.h,
    ) ?? null
  );
}
