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

/** `HTMLMediaElement.HAVE_CURRENT_DATA`: a frame at the current time is decoded and drawable. */
const HAVE_CURRENT_DATA = 2;

/** How long to wait for a first frame before forcing one with a brief muted play. */
export const FIRST_FRAME_NUDGE_MS = 1500;

/** The parts of a `<video>` that `whenFirstFrame` uses. */
export type FrameLoadable = Pick<
  HTMLVideoElement,
  "readyState" | "currentTime" | "play" | "pause" | "addEventListener" | "removeEventListener"
> & { requestVideoFrameCallback?: (callback: () => void) => number };

const FRAME_EVENTS = ["loadeddata", "canplay", "seeked", "playing", "timeupdate"] as const;

/**
 * Calls `onFrame` once, when `video` has a frame it can actually draw, and
 * returns a cleanup. Set the video's `src` after calling this.
 *
 * iOS Safari doesn't decode a frame for a video that hasn't played, so once
 * the metadata loads we seek a hair past 0. Some clips, such as iPhone
 * time-lapses, can still fire load events with no frame decoded, which left
 * the panel blank. So `onFrame` waits for `readyState >= HAVE_CURRENT_DATA`,
 * and if no frame has arrived after `nudgeMs`, the muted video plays briefly
 * to force one and is paused again as soon as it has a frame.
 */
export function whenFirstFrame(
  video: FrameLoadable,
  onFrame: () => void,
  nudgeMs: number = FIRST_FRAME_NUDGE_MS,
): () => void {
  let done = false;
  let nudged = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    done = true;
    clearTimeout(timer);
    video.removeEventListener("loadedmetadata", onMetadata);
    for (const name of FRAME_EVENTS) video.removeEventListener(name, check);
  };

  function check() {
    if (done || video.readyState < HAVE_CURRENT_DATA) return;
    cleanup();
    if (nudged) video.pause();
    onFrame();
  }

  function onMetadata() {
    if (done) return;
    if (video.readyState < HAVE_CURRENT_DATA) video.currentTime = 0.001;
    timer = setTimeout(() => {
      if (done) return;
      nudged = true;
      void Promise.resolve(video.play()).catch(() => {});
    }, nudgeMs);
    check();
  }

  video.addEventListener("loadedmetadata", onMetadata);
  for (const name of FRAME_EVENTS) video.addEventListener(name, check);
  // Fires when a frame is actually presented, which is the most reliable
  // signal on Safari 15.4+ and Chromium.
  video.requestVideoFrameCallback?.(() => check());
  return cleanup;
}
