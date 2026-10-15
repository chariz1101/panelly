"use client";

import { useEffect, useRef } from "react";
import { projectDurationMs, sourceTimeFor } from "@/lib/geometry/duration";
import { advancePlayhead, needsResync } from "@/lib/geometry/playhead";
import { MAX_DURATION_MS } from "@/lib/geometry/output";
import type { PanelSources } from "@/lib/render/renderComposite";
import { useEditorStore } from "@/store/editor";

/** Seek `video` to the source time for `playheadMs` if it has drifted. */
function syncVideo(
  video: HTMLVideoElement,
  panel: Parameters<typeof sourceTimeFor>[0],
  playheadMs: number,
): void {
  const targetMs = sourceTimeFor(panel, playheadMs);
  const clipMs = Math.min(panel.media?.durationMs ?? 0, MAX_DURATION_MS);
  if (needsResync(video.currentTime * 1000, targetMs, clipMs)) {
    video.currentTime = targetMs / 1000;
  }
}

/**
 * The single `requestAnimationFrame` clock behind preview playback (SPEC §7).
 * While playing, each frame advances one shared playhead, keeps every video
 * panel at `sourceTimeFor(panel, playhead)` and calls `redraw`. While paused,
 * videos hold the playhead frame and redraw when a seek lands.
 */
export function usePreviewClock(sources: PanelSources, redraw: () => void): void {
  const isPlaying = useEditorStore((s) => s.playback.isPlaying);
  const playhead = useRef(0);

  useEffect(() => {
    const videos = () => {
      const out: Array<{ video: HTMLVideoElement; panelId: string }> = [];
      for (const [panelId, source] of sources) {
        if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
          out.push({ video: source, panelId });
        }
      }
      return out;
    };
    const panelFor = (id: string) => useEditorStore.getState().panels.find((p) => p.id === id);

    if (!isPlaying) {
      const cleanups: Array<() => void> = [];
      for (const { video, panelId } of videos()) {
        video.pause();
        const panel = panelFor(panelId);
        if (panel) syncVideo(video, panel, playhead.current);
        video.addEventListener("seeked", redraw);
        cleanups.push(() => video.removeEventListener("seeked", redraw));
      }
      return () => cleanups.forEach((fn) => fn());
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { panels, setPlaying } = useEditorStore.getState();
      const durationMs = projectDurationMs(panels);
      if (durationMs <= 0) {
        setPlaying(false);
        return;
      }
      playhead.current = advancePlayhead(playhead.current, now - last, durationMs);
      last = now;
      for (const { video, panelId } of videos()) {
        const panel = panelFor(panelId);
        if (!panel) continue;
        syncVideo(video, panel, playhead.current);
        if (video.paused) void video.play().catch(() => {});
      }
      redraw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, sources, redraw]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) useEditorStore.getState().setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}
