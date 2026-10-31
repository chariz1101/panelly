import { describe, expect, it, vi } from "vitest";
import { applyMuteState, primeVideos } from "@/lib/render/videoElements";
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
