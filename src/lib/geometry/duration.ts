import { MAX_DURATION_MS } from "@/lib/geometry/output";
import type { Panel } from "@/types";

/**
 * Project duration (SPEC §4): the longest video panel, capped at 15 s.
 * 0 means there are no videos, so the project is a still-image export.
 */
export function projectDurationMs(panels: ReadonlyArray<Pick<Panel, "media">>): number {
  let longest = 0;
  for (const { media } of panels) {
    if (media?.kind === "video" && Number.isFinite(media.durationMs)) {
      longest = Math.max(longest, media.durationMs);
    }
  }
  return Math.min(MAX_DURATION_MS, longest);
}

/**
 * Source time (ms) to show for a panel at project time `tMs` (SPEC §4).
 * Images and empty panels are always 0. Videos shorter than the project loop
 * via modulo; videos longer than 15 s only ever play their first 15 s.
 * Shared by the preview clock and the export frame loop.
 */
export function sourceTimeFor(panel: Pick<Panel, "media">, tMs: number): number {
  const { media } = panel;
  if (media?.kind !== "video") return 0;
  const clipMs = Math.min(media.durationMs, MAX_DURATION_MS);
  if (!(clipMs > 0) || !Number.isFinite(tMs)) return 0;
  return Math.max(tMs, 0) % clipMs;
}
