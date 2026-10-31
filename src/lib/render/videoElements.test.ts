import { describe, expect, it, vi } from "vitest";
import {
  applyMuteState,
  primeVideos,
  whenFirstFrame,
  type FrameLoadable,
} from "@/lib/render/videoElements";
import type { Panel } from "@/types";

const panel = (id: string, kind: "video" | "image", muted: boolean) =>
  ({
    id,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
    media: { kind, muted },
  }) as unknown as Panel;

const fakeVideo = (muted = true) => ({
  muted,
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
});

describe("applyMuteState", () => {
  it("copies each video panel's muted flag onto its element", () => {
    const a = fakeVideo();
    const b = fakeVideo(false);
    applyMuteState(
      [panel("a", "video", false), panel("b", "video", true), panel("c", "image", true)],
      new Map([
        ["a", a],
        ["b", b],
      ]),
    );
    expect(a.muted).toBe(false);
    expect(b.muted).toBe(true);
  });
});

describe("primeVideos", () => {
  it("plays every video and swallows rejected play() calls", () => {
    const a = fakeVideo();
    const b = fakeVideo();
    b.play.mockRejectedValue(new Error("NotAllowedError"));
    expect(() =>
      primeVideos(
        new Map([
          ["a", a],
          ["b", b],
        ]),
      ),
    ).not.toThrow();
    expect(a.play).toHaveBeenCalled();
    expect(b.play).toHaveBeenCalled();
  });
});

class FakeVideo extends EventTarget {
  readyState = 0;
  currentTime = 0;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  fire(name: string, readyState = this.readyState) {
    this.readyState = readyState;
    this.dispatchEvent(new Event(name));
  }
}

const asVideo = (v: FakeVideo) => v as unknown as FrameLoadable;

describe("whenFirstFrame", () => {
  it("waits for a drawable frame, not just a load event", () => {
    vi.useFakeTimers();
    const video = new FakeVideo();
    const onFrame = vi.fn();
    whenFirstFrame(asVideo(video), onFrame);

    video.fire("loadedmetadata", 1);
    expect(video.currentTime).toBe(0.001);
    video.fire("seeked", 1); // seek finished, but no frame decoded yet
    expect(onFrame).not.toHaveBeenCalled();

    video.fire("loadeddata", 2);
    expect(onFrame).toHaveBeenCalledOnce();
    video.fire("canplay", 4);
    expect(onFrame).toHaveBeenCalledOnce();
    expect(video.play).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("plays briefly to force a frame when none arrives, then pauses", () => {
    vi.useFakeTimers();
    const video = new FakeVideo();
    const onFrame = vi.fn();
    whenFirstFrame(asVideo(video), onFrame, 1000);

    video.fire("loadedmetadata", 1);
    video.fire("seeked", 1);
    vi.advanceTimersByTime(1000);
    expect(video.play).toHaveBeenCalledOnce();

    video.fire("playing", 3);
    expect(video.pause).toHaveBeenCalledOnce();
    expect(onFrame).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("does nothing after cleanup", () => {
    vi.useFakeTimers();
    const video = new FakeVideo();
    const onFrame = vi.fn();
    const stop = whenFirstFrame(asVideo(video), onFrame, 1000);
    video.fire("loadedmetadata", 1);
    stop();
    vi.advanceTimersByTime(1000);
    video.fire("loadeddata", 2);
    expect(video.play).not.toHaveBeenCalled();
    expect(onFrame).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
