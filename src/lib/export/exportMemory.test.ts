import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Panel } from "@/types";
import type { DemuxedVideo } from "./demux";
import { runFrameLoop } from "./frameLoop";
import {
  PanelDecoder,
  type DecoderFactory,
  type DecoderLike,
  type HeldFrame,
} from "./panelDecoder";

/**
 * Task 4.12 in software: three 15 s clips exported at once must never hold
 * more than a few decoded frames per panel, and must close every frame. The
 * on-device half (steady memory on a real phone) is Phase 5.
 */

const SOURCE_STEP_US = 33_333; // 30 fps source
const MAX_LIVE_PER_PANEL = 6;

function clip(id: string, durationMs: number, y: number): { panel: Panel; video: DemuxedVideo } {
  const frames = Math.ceil((durationMs / 1000) * 30);
  const chunks = Array.from({ length: frames }, (_, i) => ({
    type: i % 30 === 0 ? "key" : "delta",
    timestamp: i * SOURCE_STEP_US,
  }));
  return {
    panel: {
      id,
      rect: { x: 0, y, w: 1080, h: 640 },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      media: {
        kind: "video",
        file: new File([], `${id}.mp4`),
        objectUrl: "",
        naturalWidth: 1920,
        naturalHeight: 1080,
        durationMs,
        muted: true,
      },
    },
    video: {
      config: { codec: "avc1.42001f" },
      chunks: chunks as unknown as EncodedVideoChunk[],
      rotation: 0,
    },
  };
}

describe("export memory (3 × 15 s clips)", () => {
  const liveOutput = new Set<object>();
  let maxLiveOutput = 0;

  beforeEach(() => {
    liveOutput.clear();
    maxLiveOutput = 0;
    vi.stubGlobal(
      "VideoFrame",
      class {
        constructor() {
          liveOutput.add(this);
          maxLiveOutput = Math.max(maxLiveOutput, liveOutput.size);
        }
        close() {
          liveOutput.delete(this);
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps few frames alive and closes all of them", async () => {
    const live = new Map<string, Set<number>>();
    const peak = new Map<string, number>();

    const decoders = new Map<string, PanelDecoder>();
    const clips = [clip("a", 15_000, 0), clip("b", 6_000, 640), clip("c", 20_000, 1280)];

    for (const { panel, video } of clips) {
      const open = new Set<number>();
      live.set(panel.id, open);
      const factory: DecoderFactory = (init) => {
        const decoder = {
          decodeQueueSize: 0,
          ondequeue: null as (() => void) | null,
          configure() {},
          decode(chunk: EncodedVideoChunk) {
            decoder.decodeQueueSize++;
            queueMicrotask(() => {
              decoder.decodeQueueSize--;
              init.output({ timestamp: chunk.timestamp } as VideoFrame);
              decoder.ondequeue?.();
            });
          },
          flush: () => Promise.resolve(),
          reset() {},
          close() {},
        } satisfies DecoderLike;
        return decoder;
      };
      const normalize = (frame: VideoFrame): HeldFrame => {
        const ts = frame.timestamp;
        open.add(ts);
        peak.set(panel.id, Math.max(peak.get(panel.id) ?? 0, open.size));
        return {
          source: { ts } as unknown as ImageBitmap,
          timestamp: ts,
          close: () => open.delete(ts),
        };
      };
      decoders.set(panel.id, new PanelDecoder(video, { createDecoder: factory, normalize }));
    }

    const ctx = {
      save() {},
      restore() {},
      fillRect() {},
      beginPath() {},
      rect() {},
      clip() {},
      drawImage() {},
      fillStyle: "",
    };

    const total = await runFrameLoop({
      project: { layoutId: "x", panels: clips.map((c) => c.panel), durationMs: 15_000 },
      ctx: ctx as unknown as CanvasRenderingContext2D,
      canvas: {} as OffscreenCanvas,
      stills: new Map(),
      feeds: decoders,
      sink: { encode: () => Promise.resolve() },
    });

    expect(total).toBe(450);
    for (const id of ["a", "b", "c"]) {
      expect(peak.get(id)).toBeLessThanOrEqual(MAX_LIVE_PER_PANEL);
    }
    // Each composited VideoFrame is closed before the next is created.
    expect(maxLiveOutput).toBe(1);
    expect(liveOutput.size).toBe(0);

    for (const d of decoders.values()) d.close();
    for (const open of live.values()) expect(open.size).toBe(0);
  });
});
