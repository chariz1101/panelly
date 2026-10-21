import { describe, expect, it } from "vitest";
import { UNREADABLE_FILE_MESSAGE, snapshotFile } from "./snapshotFile";

describe("snapshotFile", () => {
  it("returns a File with the same name, type and bytes", async () => {
    const source = new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });
    const copy = await snapshotFile(source);
    expect(copy).not.toBe(source);
    expect(copy.name).toBe("clip.mp4");
    expect(copy.type).toBe("video/mp4");
    expect(new Uint8Array(await copy.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("reports an unreadable file with a clear message", async () => {
    const broken = {
      arrayBuffer: () => Promise.reject(new DOMException("denied", "NotReadableError")),
    } as unknown as File;
    await expect(snapshotFile(broken)).rejects.toThrow(UNREADABLE_FILE_MESSAGE);
  });
});
