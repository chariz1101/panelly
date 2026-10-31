import type { Panel } from "@/types";
import type { PanelSource } from "@/lib/render/drawPanel";

type VideoLike = Pick<HTMLVideoElement, "muted" | "play" | "pause">;

const isVideo = (source: PanelSource | undefined): source is HTMLVideoElement =>
  typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement;

/**
 * Mirror each panel's `muted` flag onto its `<video>`. Call this synchronously
 * inside the tap handler that changes it: iOS only lets a video be unmuted
 * from a user gesture.
 */
export function applyMuteState(
  panels: readonly Panel[],
  sources: ReadonlyMap<string, PanelSource | VideoLike>,
): void {
  for (const p of panels) {
    const el = sources.get(p.id) as VideoLike | undefined;
    if (el && p.media?.kind === "video") el.muted = p.media.muted;
  }
}

/**
 * Start every loaded video from inside a user gesture. iOS Safari only allows
 * `play()` after a tap, so the Play button calls this before the rAF clock
 * (which is not a gesture) takes over. Rejections are ignored; the clock retries.
 */
export function primeVideos(sources: ReadonlyMap<string, PanelSource | VideoLike>): void {
  for (const source of sources.values()) {
    if (isVideo(source as PanelSource) || typeof (source as VideoLike).play === "function") {
      const result = (source as VideoLike).play() as Promise<void> | undefined;
      void result?.catch(() => {});
    }
  }
}
