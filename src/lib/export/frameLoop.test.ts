import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Panel } from "@/types";
import { runFrameLoop, sourceTimeUsFor, type FrameFeed } from "./frameLoop";

function videoPanel(id: string, durationMs: number): Panel {
  return {
    id,
    rect: { x: 0, y: 0, w: 1080, h: 640 },
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
    media: {
      kind: "video",
      file: new File([], "v.mp4"),
      objectUrl: "",
      naturalWidth: 1080,
      naturalHeight: 1920,
      durationMs,
      muted: true,
    },
  };
}

describe("sourceTimeUsFor", () => {
  it("loops short clips and caps long ones through sourceTimeFor", () => {
    const short = videoPanel("a", 1000);
    expect(sourceTimeUsFor(short, 0)).toBe(0);
    expect(sourceTimeUsFor(short, 15)).toBe(500_000);
    expect(sourceTimeUsFor(short, 30)).toBe(0); // looped
    expect(sourceTimeUsFor(short, 45)).toBe(500_000);
  });

  it("is 0 for panels without video", () => {
    expect(sourceTimeUsFor({ media: null }, 10)).toBe(0);
  });
});

describe("runFrameLoop", () => {
  const closed: number[] = [];

  beforeEach(() => {
    closed.length = 0;
    vi.stubGlobal(
      "VideoFrame",
      class {
        constructor(
          public canvas: unknown,
          public init: { timestamp: number; duration: number },
        ) {}
        close() {
          closed.push(this.init.timestamp);
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

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
  const canvas = {} as OffscreenCanvas;

  function setup(durationMs: number) {
    const requested: number[] = [];
    const feed: FrameFeed = {
      frameAt: (us) => {
        requested.push(us);
        return Promise.resolve({ width: 1080, height: 1920 } as unknown as ImageBitmap);
      },
    };
    const panel = videoPanel("p1", 1000);
    const encoded: Array<{ ts: number; index: number }> = [];
    const sink = {
      encode: (frame: VideoFrame, index: number) => {
        encoded.push({
          ts: (frame as unknown as { init: { timestamp: number } }).init.timestamp,
          index,
        });
        return Promise.resolve();
      },
    };
    const run = (extra = {}) =>
      runFrameLoop({
        project: { layoutId: "x", panels: [panel], durationMs },
        ctx: ctx as unknown as CanvasRenderingContext2D,
        canvas,
        stills: new Map(),
        feeds: new Map([["p1", feed]]),
        sink,
        ...extra,
      });
    return { requested, encoded, run };
  }

  it("produces durationMs/1000*30 frames with 1/30 s timestamps and closes each one", async () => {
    const { encoded, run, requested } = setup(2000);
    const progress: number[] = [];
    const total = await run({ onProgress: (done: number) => progress.push(done) });

    expect(total).toBe(60);
    expect(encoded).toHaveLength(60);
    expect(encoded[1]).toEqual({ ts: 33_333, index: 1 });
    expect(encoded[59]?.ts).toBe(1_966_667);
    expect(closed).toHaveLength(60);
    expect(progress.at(-1)).toBe(60);
    // The 1 s clip loops inside the 2 s project.
    expect(requested[30]).toBe(0);
  });

  it("closes the frame even when the sink fails", async () => {
    const { run } = setup(1000);
    await expect(
      run({
        sink: { encode: () => Promise.reject(new Error("encode failed")) },
      }),
    ).rejects.toThrow("encode failed");
    expect(closed).toHaveLength(1);
  });

  it("stops when aborted", async () => {
    const { run, encoded } = setup(2000);
    const controller = new AbortController();
    controller.abort();
    await expect(run({ signal: controller.signal })).rejects.toThrow();
    expect(encoded).toHaveLength(0);
  });
});
