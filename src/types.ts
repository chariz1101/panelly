/**
 * Core editor data model (SPEC §3).
 *
 * All geometry lives in the fixed 1080×1920 output space (see
 * `@/lib/geometry/output`). On-screen views scale from it at render time only.
 */

export type MediaKind = "image" | "video";

/** An axis-aligned box in output-space pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanelMedia {
  kind: MediaKind;
  file: File;
  objectUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  /** 0 for images. */
  durationMs: number;
  /** Always starts `true`: audio is muted by default on every panel. */
  muted: boolean;
}

/** How media is framed inside its panel. */
export interface Transform {
  /** >= 1, where 1 = cover-fit. */
  scale: number;
  /** Normalized -1..1 from the centre. */
  offsetX: number;
  /** Normalized -1..1 from the centre. */
  offsetY: number;
}

export interface Panel {
  id: string;
  rect: Rect;
  media: PanelMedia | null;
  transform: Transform;
}

export interface Layout {
  id: string;
  name: string;
  panels: Array<Pick<Panel, "rect">>;
  gapPx: number;
  backgroundColor: string;
}

export interface Project {
  layoutId: string;
  panels: Panel[];
  /** Computed: max video duration, hard-capped at MAX_DURATION_MS (15000). */
  durationMs: number;
  /** Which panel's audio survives export; `null` = silent. */
  audioPanelId: string | null;
}
