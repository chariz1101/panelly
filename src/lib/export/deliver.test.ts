import { describe, expect, it, vi } from "vitest";
import { canShareFiles, deliverFile, type DeliverEnv } from "@/lib/export/deliver";

const blob = new Blob(["x"], { type: "image/png" });

describe("deliverFile", () => {
  it("downloads when the Web Share API is missing", async () => {
    const download = vi.fn();
    expect(await deliverFile(blob, "a.png", { download })).toBe("downloaded");
    expect(download).toHaveBeenCalledWith(blob, "a.png");
  });

  it("downloads when canShare rejects files", async () => {
    const env: DeliverEnv = { share: vi.fn(), canShare: () => false, download: vi.fn() };
    expect(await deliverFile(blob, "a.png", env)).toBe("downloaded");
    expect(env.share).not.toHaveBeenCalled();
  });

  it("shares the file when allowed", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const env: DeliverEnv = { share, canShare: () => true, download: vi.fn() };
    expect(await deliverFile(blob, "a.png", env)).toBe("shared");
    const file = (share.mock.calls[0]?.[0] as ShareData).files?.[0] as File;
    expect(file.name).toBe("a.png");
    expect(file.type).toBe("image/png");
    expect(env.download).not.toHaveBeenCalled();
  });

  it("treats a dismissed share sheet as cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("x", "AbortError"));
    const env: DeliverEnv = { share, canShare: () => true, download: vi.fn() };
    expect(await deliverFile(blob, "a.png", env)).toBe("cancelled");
    expect(env.download).not.toHaveBeenCalled();
  });

  it("falls back to download on other share failures", async () => {
    const share = vi.fn().mockRejectedValue(new Error("boom"));
    const env: DeliverEnv = { share, canShare: () => true, download: vi.fn() };
    expect(await deliverFile(blob, "a.png", env)).toBe("downloaded");
    expect(env.download).toHaveBeenCalledOnce();
  });

  it("shares an MP4 with its video/mp4 type", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const env: DeliverEnv = { share, canShare: () => true, download: vi.fn() };
    const mp4 = new Blob(["x"], { type: "video/mp4" });
    expect(await deliverFile(mp4, "panelly.mp4", env)).toBe("shared");
    const file = (share.mock.calls[0]?.[0] as ShareData).files?.[0] as File;
    expect(file.name).toBe("panelly.mp4");
    expect(file.type).toBe("video/mp4");
  });
});

describe("canShareFiles", () => {
  it("is false without the Web Share API", () => {
    expect(canShareFiles("image/png", { download: vi.fn() })).toBe(false);
  });

  it("follows canShare", () => {
    const env = (ok: boolean): DeliverEnv => ({
      share: vi.fn(),
      canShare: () => ok,
      download: vi.fn(),
    });
    expect(canShareFiles("video/mp4", env(true))).toBe(true);
    expect(canShareFiles("video/mp4", env(false))).toBe(false);
  });
});
