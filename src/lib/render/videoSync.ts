import { sourceTimeFor } from "@/lib/geometry/duration";
import { MAX_DURATION_MS } from "@/lib/geometry/output";
import { needsResync } from "@/lib/geometry/playhead";
import type { Panel } from "@/types";

/** Seek `video` to the source time for `playheadMs` if it has drifted. */
export function syncVideo(video: HTMLVideoElement, panel: Panel, playheadMs: number): void {
  const targetMs = sourceTimeFor(panel, playheadMs);
  const clipMs = Math.min(panel.media?.durationMs ?? 0, MAX_DURATION_MS);
  if (needsResync(video.currentTime * 1000, targetMs, clipMs)) {
    video.currentTime = targetMs / 1000;
  }
}
