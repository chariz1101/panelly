import { describe, expect, it, vi } from "vitest";
import { deliverFile, type DeliverEnv } from "@/lib/export/deliver";

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
});
