import { afterEach, describe, expect, it, vi } from "vitest";
import type { DemuxedVideo } from "./demux";
import {
  createFrameNormalizer,
  PanelDecoder,
  type DecoderFactory,
  type DecoderLike,
  type HeldFrame,
} from "./panelDecoder";

const STEP = 40_000; // 25 fps source

interface FakeChunk {
  type: "key" | "delta";
  timestamp: number;
}

/** In-order decoder: each `decode` emits one frame with the chunk's timestamp. */
function makeFake() {
  const log = { open: new Set<number>(), maxOpen: 0, resets: 0, decoded: [] as number[] };
  const factory: DecoderFactory = (init) => {
    const decoder = {
      decodeQueueSize: 0,
      ondequeue: null as (() => void) | null,
      configure() {},
      decode(chunk: EncodedVideoChunk) {
        log.decoded.push(chunk.timestamp);
        decoder.decodeQueueSize++;
        queueMicrotask(() => {
          decoder.decodeQueueSize--;
          init.output({ timestamp: chunk.timestamp } as VideoFrame);
          decoder.ondequeue?.();
        });
      },
      flush: () => Promise.resolve(),
      reset() {
        log.resets++;
      },
      close() {},
    } satisfies DecoderLike;
    return decoder;
  };
  const normalize = (frame: VideoFrame): HeldFrame => {
    const ts = frame.timestamp;
    log.open.add(ts);
    log.maxOpen = Math.max(log.maxOpen, log.open.size);
    return {
      source: { ts } as unknown as ImageBitmap,
      timestamp: ts,
      close: () => log.open.delete(ts),
    };
  };
  return { log, factory, normalize };
}

function video(frames: number): DemuxedVideo {
  const chunks: FakeChunk[] = Array.from({ length: frames }, (_, i) => ({
    type: i === 0 ? "key" : "delta",
    timestamp: i * STEP,
  }));
  return {
    config: { codec: "avc1.42001f" },
    chunks: chunks as unknown as EncodedVideoChunk[],
    rotation: 0,
  };
}

const tsOf = (source: unknown) => (source as { ts: number }).ts;

describe("PanelDecoder", () => {
  it("returns the nearest decoded frame for each target", async () => {
    const fake = makeFake();
    const d = new PanelDecoder(video(10), {
      createDecoder: fake.factory,
      normalize: fake.normalize,
    });
    expect(tsOf(await d.frameAt(0))).toBe(0);
    expect(tsOf(await d.frameAt(33_333))).toBe(40_000);
    expect(tsOf(await d.frameAt(66_667))).toBe(80_000);
    expect(tsOf(await d.frameAt(100_000))).toBe(80_000);
    d.close();
  });

  it("holds only a few frames and closes everything on close()", async () => {
    const fake = makeFake();
    const d = new PanelDecoder(video(200), {
      createDecoder: fake.factory,
      normalize: fake.normalize,
    });
    for (let i = 0; i < 150; i++) await d.frameAt((i * 1_000_000) / 30);
    expect(fake.log.maxOpen).toBeLessThanOrEqual(6);
    expect(d.bufferedCount).toBeLessThanOrEqual(6);
    d.close();
    expect(fake.log.open.size).toBe(0);
  });

  it("resets and restarts from the first keyframe when the target goes backwards", async () => {
    const fake = makeFake();
    const d = new PanelDecoder(video(10), {
      createDecoder: fake.factory,
      normalize: fake.normalize,
    });
    await d.frameAt(0);
    await d.frameAt(300_000);
    expect(fake.log.resets).toBe(0);

    fake.log.decoded.length = 0;
    expect(tsOf(await d.frameAt(10_000))).toBe(0);
    expect(fake.log.resets).toBe(1);
    expect(fake.log.decoded[0]).toBe(0);
    d.close();
  });

  it("falls back to the last frame past the end of the clip", async () => {
    const fake = makeFake();
    const d = new PanelDecoder(video(3), {
      createDecoder: fake.factory,
      normalize: fake.normalize,
    });
    expect(tsOf(await d.frameAt(500_000))).toBe(80_000);
    d.close();
  });

  it("surfaces decoder errors", async () => {
    let fail: (e: Error) => void = () => {};
    const factory: DecoderFactory = (init) => {
      fail = init.error;
      return {
        decodeQueueSize: 0,
        ondequeue: null,
        configure() {},
        decode() {
          queueMicrotask(() => fail(new Error("boom")));
        },
        flush: () => Promise.resolve(),
        reset() {},
        close() {},
      };
    };
    const d = new PanelDecoder(video(3), {
      createDecoder: factory,
      normalize: makeFake().normalize,
    });
    await expect(d.frameAt(0)).rejects.toThrow("boom");
  });
});

describe("createFrameNormalizer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("copies even an upright, full-size frame, since Safari can't crop a VideoFrame", () => {
    const bitmap = { close: vi.fn() };
    const drawImage = vi.fn();
    class FakeCanvas {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext = () => ({ save() {}, restore() {}, translate() {}, rotate() {}, drawImage });
      transferToImageBitmap = () => bitmap;
    }
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);

    const frame = { displayWidth: 1920, displayHeight: 1080, timestamp: 5, close: vi.fn() };
    const held = createFrameNormalizer(0, 1)(frame as unknown as VideoFrame);

    expect(held.source).toBe(bitmap);
    expect(held.timestamp).toBe(5);
    expect(drawImage).toHaveBeenCalledWith(frame, -960, -540, 1920, 1080);
    expect(frame.close).toHaveBeenCalledOnce();
    held.close();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
