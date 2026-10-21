import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import {
  renderComposite,
  type CompositeProject,
  type PanelSources,
} from "@/lib/render/renderComposite";
import { syncVideo } from "@/lib/render/videoSync";
import { pickRecorderMime } from "./support";

/** Rejection reason of `FallbackHandle.result` after `cancel()`. */
export class FallbackCancelled extends Error {}

/** A running Limited-mode recording. */
export interface FallbackHandle {
  result: Promise<Blob>;
  /** Stop recording and discard the output; `result` rejects with `FallbackCancelled`. */
  cancel: () => void;
}

export interface FallbackOptions {
  durationMs: number;
  onProgress?: (fraction: number) => void;
}

/**
 * Limited mode (SPEC §6.3): play the composite in real time on a canvas and
 * record it with `captureStream(30)` + `MediaRecorder`. A 15 s video takes 15 s.
 * Uses the same `renderComposite` as the preview and WebCodecs paths.
 */
export function recordFallback(
  project: CompositeProject,
  sources: PanelSources,
  { durationMs, onProgress }: FallbackOptions,
): FallbackHandle {
  let cancelled = false;
  let stopNow: () => void = () => {};

  const result = new Promise<Blob>((resolve, reject) => {
    if (typeof MediaRecorder === "undefined") {
      reject(new Error("This browser can't record video, so the video can't be exported."));
      return;
    }
    const mime = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!mime || !ctx || typeof canvas.captureStream !== "function") {
      reject(new Error("This browser can't record video, so the video can't be exported."));
      return;
    }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    let raf = 0;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error("Recording failed."));
    };
    recorder.onstop = () => {
      cleanup();
      if (cancelled) reject(new FallbackCancelled());
      else resolve(new Blob(chunks, { type: mime.split(";")[0] }));
    };
    stopNow = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };

    const videos: Array<{ video: HTMLVideoElement; panelId: string }> = [];
    for (const [panelId, source] of sources) {
      if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
        videos.push({ video: source, panelId });
      }
    }
    for (const { video } of videos) void video.play().catch(() => {});

    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      for (const { video, panelId } of videos) {
        const panel = project.panels.find((p) => p.id === panelId);
        if (panel) syncVideo(video, panel, Math.min(elapsed, durationMs));
      }
      renderComposite(ctx, project, sources);
      onProgress?.(Math.min(elapsed / durationMs, 1));
      if (elapsed >= durationMs) {
        stopNow();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    recorder.start();
    raf = requestAnimationFrame(tick);
  });

  return {
    result,
    cancel: () => {
      cancelled = true;
      stopNow();
    },
  };
}
