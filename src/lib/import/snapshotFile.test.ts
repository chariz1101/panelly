import { describe, expect, it, vi } from "vitest";
import { UNREADABLE_FILE_MESSAGE, needsSnapshot, snapshotFile } from "./snapshotFile";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

describe("snapshotFile", () => {
  it("returns a File with the same name, type and bytes", async () => {
    const source = new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });
    const copy = await snapshotFile(source, ANDROID);
    expect(copy).not.toBe(source);
    expect(copy.name).toBe("clip.mp4");
    expect(copy.type).toBe("video/mp4");
    expect(new Uint8Array(await copy.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("reports an unreadable file with a clear message", async () => {
    const broken = {
      arrayBuffer: () => Promise.reject(new DOMException("denied", "NotReadableError")),
    } as unknown as File;
    await expect(snapshotFile(broken, ANDROID)).rejects.toThrow(UNREADABLE_FILE_MESSAGE);
  });

  it("returns the same file on iPhone, without copying it into memory", async () => {
    const source = new File([new Uint8Array([1])], "IMG_0001.MOV", { type: "video/quicktime" });
    const read = vi.spyOn(source, "arrayBuffer");
    expect(await snapshotFile(source, IPHONE)).toBe(source);
    expect(read).not.toHaveBeenCalled();
  });

  it("only copies on Android", () => {
    expect(needsSnapshot(ANDROID)).toBe(true);
    expect(needsSnapshot(IPHONE)).toBe(false);
  });
});
