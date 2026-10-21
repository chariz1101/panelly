import { frameCount, OUTPUT_FPS } from "@/lib/geometry/output";
import { sourceTimeFor } from "@/lib/geometry/duration";
import type { Ctx2D, PanelSource } from "@/lib/render/drawPanel";
import {
  renderComposite,
  type CompositeProject,
  type PanelSources,
} from "@/lib/render/renderComposite";
import type { Panel } from "@/types";
import { frameTimestampUs } from "./frameCursor";

/** Supplies the decoded frame nearest a source time, e.g. a `PanelDecoder`. */
export interface FrameFeed {
  frameAt(sourceTimeUs: number): Promise<PanelSource>;
}

/** Receives each composited frame; the encoder in 4.5 implements this. */
export interface FrameSink {
  /**
   * Encode `frame`. The loop closes it as soon as this resolves, so a sink that
   * needs it longer must copy it. Backpressure (SPEC §6.2) belongs here: the
   * loop doesn't advance until the returned promise settles.
   */
  encode(frame: VideoFrame, index: number): Promise<void>;
}

export interface FrameLoopOptions {
  project: CompositeProject & { durationMs: number };
  /** Draws onto `canvas`; both are 1080×1920. */
  ctx: Ctx2D;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  /**
   * Size the encoder is configured for. When it differs from `canvas`, each
   * composite is scaled down to it first so the encoder gets exact-size frames.
   */
  encodeSize?: { width: number; height: number };
  /** Fixed drawables for image panels, keyed by panel id. */
  stills: PanelSources;
  /** One feed per video panel, keyed by panel id. */
  feeds: ReadonlyMap<string, FrameFeed>;
  sink: FrameSink;
  /** Called after each frame is handed to the sink. */
  onProgress?: (framesDone: number, framesTotal: number) => void;
  signal?: AbortSignal;
}

/** Source time in µs for `panel` at output frame `index`, via the shared `sourceTimeFor`. */
export function sourceTimeUsFor(panel: Pick<Panel, "media">, index: number): number {
  const tMs = (index * 1000) / OUTPUT_FPS;
  return Math.round(sourceTimeFor(panel, tMs) * 1000);
}

/**
 * The export frame loop (SPEC §6.1.3): for every output frame, pick each video
 * panel's nearest source frame via `sourceTimeFor`, composite with the same
 * `renderComposite` the preview uses, wrap the canvas in a `VideoFrame`, hand
 * it to the sink, and close it. Returns the number of frames produced.
 */
export async function runFrameLoop(options: FrameLoopOptions): Promise<number> {
  const { project, ctx, canvas, stills, feeds, sink, onProgress, signal, encodeSize } = options;
  const scaled =
    encodeSize && (encodeSize.width !== canvas.width || encodeSize.height !== canvas.height)
      ? scaledSurface(encodeSize)
      : null;
  const total = frameCount(project.durationMs);
  const frameDurationUs = Math.round(1_000_000 / OUTPUT_FPS);

  for (let i = 0; i < total; i++) {
    signal?.throwIfAborted();

    const sources = new Map(stills);
    for (const panel of project.panels) {
      if (panel.media?.kind !== "video") continue;
      const feed = feeds.get(panel.id);
      if (!feed) throw new Error("A video in this project couldn't be decoded.");
      sources.set(panel.id, await feed.frameAt(sourceTimeUsFor(panel, i)));
    }

    renderComposite(ctx, project, sources);

    scaled?.ctx.drawImage(canvas, 0, 0, scaled.canvas.width, scaled.canvas.height);
    const frame = new VideoFrame(scaled?.canvas ?? canvas, {
      timestamp: frameTimestampUs(i),
      duration: frameDurationUs,
    });
    try {
      await sink.encode(frame, i);
    } finally {
      frame.close();
    }
    onProgress?.(i + 1, total);
  }
  return total;
}

/** A smaller canvas the full-size composite is drawn onto before encoding. */
function scaledSurface(size: { width: number; height: number }) {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't create a canvas to export the video.");
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}
