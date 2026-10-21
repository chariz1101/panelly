import { describe, expect, it, vi } from "vitest";
import {
  ENCODER_CODECS,
  FALLBACK_BITRATE,
  EncoderUnsupportedError,
  encoderConfigFor,
  pickEncoderConfig,
} from "./encoderConfig";
import { FrameEncoder, waitForQueue, type EncoderLike } from "./frameEncoder";

describe("encoderConfigFor", () => {
  it("matches SPEC §6.1.4", () => {
    expect(encoderConfigFor("avc1.42001f")).toEqual({
      codec: "avc1.42001f",
      width: 1080,
      height: 1920,
      bitrate: 6_000_000,
      framerate: 30,
      avc: { format: "avc" },
    });
  });
});

describe("pickEncoderConfig", () => {
  it("uses the spec codec when supported", async () => {
    const check = vi.fn().mockResolvedValue({ supported: true });
    expect((await pickEncoderConfig(check)).codec).toBe(ENCODER_CODECS[0]);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("falls back to later codecs, including after a rejection", async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce({ supported: false })
      .mockRejectedValueOnce(new TypeError("bad"))
      .mockResolvedValueOnce({ supported: true });
    expect((await pickEncoderConfig(check)).codec).toBe(ENCODER_CODECS[2]);
  });

  it("retries every codec at a lower bitrate before giving up", async () => {
    const check = vi.fn().mockImplementation(async (c: VideoEncoderConfig) => ({
      supported: c.bitrate === FALLBACK_BITRATE && c.codec === ENCODER_CODECS[1],
    }));
    const picked = await pickEncoderConfig(check);
    expect(picked.codec).toBe(ENCODER_CODECS[1]);
    expect(picked.bitrate).toBe(FALLBACK_BITRATE);
  });

  it("throws when nothing is supported", async () => {
    const check = vi.fn().mockResolvedValue({ supported: false });
    await expect(pickEncoderConfig(check)).rejects.toBeInstanceOf(EncoderUnsupportedError);
  });
});

function fakeEncoder(queue: number[]): EncoderLike & { encoded: Array<{ keyFrame?: boolean }> } {
  const listeners: Array<() => void> = [];
  let i = 0;
  const encoded: Array<{ keyFrame?: boolean }> = [];
  return {
    encoded,
    get encodeQueueSize() {
      return queue[Math.min(i, queue.length - 1)] ?? 0;
    },
    encode: (_f, o) => void encoded.push(o ?? {}),
    flush: () => Promise.resolve(),
    close() {},
    addEventListener: (_t, l) => {
      listeners.push(l);
      // Each wait drains the queue one step.
      queueMicrotask(() => {
        i++;
        l();
      });
    },
  };
}

describe("backpressure", () => {
  it("waits while the queue exceeds 10, then proceeds", async () => {
    const enc = fakeEncoder([12, 11, 10]);
    await waitForQueue(enc);
    expect(enc.encodeQueueSize).toBe(10);
  });

  it("FrameEncoder holds encode() until the queue drains", async () => {
    const enc = fakeEncoder([15, 12, 5]);
    const sink = new FrameEncoder(enc);
    await sink.encode({} as VideoFrame, 0);
    expect(enc.encoded).toEqual([{ keyFrame: true }]);
    await sink.encode({} as VideoFrame, 1);
    expect(enc.encoded[1]).toEqual({ keyFrame: false });
  });
});
