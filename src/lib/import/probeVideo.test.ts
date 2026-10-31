import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIDEO_UNREADABLE_MESSAGE, probeVideo, type VideoInfo } from "./probeVideo";

const file = new File([new Uint8Array([0])], "IMG_0001.MOV", { type: "video/quicktime" });
const good: VideoInfo = { width: 1920, height: 1080, durationSec: 12.5 };

/** An element reader that resolves, rejects or never answers. */
const element = (info: Promise<VideoInfo>) => {
  const release = vi.fn();
  return { readFromElement: () => ({ info, release }), release };
};
const never = () => new Promise<VideoInfo>(() => {});

describe("probeVideo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses the browser's metadata when it arrives", async () => {
    const { readFromElement, release } = element(Promise.resolve(good));
    const readFromFile = vi.fn();
    const media = await probeVideo(file, { readFromElement, readFromFile });
    expect(media).toMatchObject({ naturalWidth: 1920, naturalHeight: 1080, durationMs: 12_500 });
    expect(media.objectUrl).toBe("blob:test");
    expect(readFromFile).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it("reads the file itself when the browser never reports metadata", async () => {
    const { readFromElement } = element(never());
    const readFromFile = vi.fn().mockResolvedValue({ width: 1080, height: 1920, durationSec: 8 });
    const result = probeVideo(file, { readFromElement, readFromFile, timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toMatchObject({ naturalWidth: 1080, durationMs: 8000 });
  });

  it("reads the file itself when the browser reports no length", async () => {
    const { readFromElement } = element(
      Promise.resolve({ width: 1920, height: 1080, durationSec: Infinity }),
    );
    const readFromFile = vi.fn().mockResolvedValue(good);
    const media = await probeVideo(file, { readFromElement, readFromFile });
    expect(media.durationMs).toBe(12_500);
  });

  it("shows a message instead of hanging when nothing can read the video", async () => {
    const { readFromElement } = element(never());
    const result = probeVideo(file, {
      readFromElement,
      readFromFile: () => Promise.resolve(null),
      timeoutMs: 5000,
    });
    const check = expect(result).rejects.toThrow(VIDEO_UNREADABLE_MESSAGE);
    await vi.advanceTimersByTimeAsync(5000);
    await check;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("still rejects videos over the size limit", async () => {
    const { readFromElement } = element(
      Promise.resolve({ width: 8192, height: 4320, durationSec: 5 }),
    );
    await expect(probeVideo(file, { readFromElement })).rejects.toThrow(/too large/);
  });
});
