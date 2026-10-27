import { describe, expect, it, vi } from "vitest";
import {
  DECODE_FAILED_MESSAGE,
  ENCODER_FAILED_MESSAGE,
  EXPORT_FAILED_MESSAGE,
  OUT_OF_MEMORY_MESSAGE,
} from "@/lib/errors/describeError";
import { UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/import/codecSupport";
import type { Panel } from "@/types";
import { failureReason, projectShape, trackExportFailed, trackExportSucceeded } from "./events";

const media = (kind: "image" | "video") =>
  ({ kind, file: new File(["secret"], "holiday.mov") }) as unknown as Panel["media"];

describe("projectShape", () => {
  it("counts filled panels and videos, and rounds the duration", () => {
    const panels = [{ media: media("image") }, { media: media("video") }, { media: null }];
    expect(projectShape(panels, 6400)).toEqual({ panels: 2, videos: 1, seconds: 6 });
  });
});

describe("failureReason", () => {
  it("maps each user-facing message to a category", () => {
    expect(failureReason(OUT_OF_MEMORY_MESSAGE)).toBe("out_of_memory");
    expect(failureReason(DECODE_FAILED_MESSAGE)).toBe("decode_failed");
    expect(failureReason(ENCODER_FAILED_MESSAGE)).toBe("encoder_failed");
    expect(failureReason(UNSUPPORTED_VIDEO_MESSAGE)).toBe("unsupported_video");
    expect(failureReason(EXPORT_FAILED_MESSAGE)).toBe("other");
  });
});

describe("track helpers", () => {
  it("sends only the allowed fields and drops undefined ones", () => {
    const send = vi.fn();
    trackExportSucceeded(
      { format: "png", mode: "still", encodedAs: undefined, panels: 3, videos: 0, seconds: 0 },
      send,
    );
    expect(send).toHaveBeenCalledWith("Export", {
      format: "png",
      mode: "still",
      panels: 3,
      videos: 0,
      seconds: 0,
    });
  });

  it("reports the encoded size for MP4 exports", () => {
    const send = vi.fn();
    trackExportSucceeded(
      {
        format: "mp4",
        mode: "full",
        encodedAs: "1920x1080-rotated",
        panels: 3,
        videos: 2,
        seconds: 15,
      },
      send,
    );
    expect(send.mock.calls[0]?.[1]).toMatchObject({ encodedAs: "1920x1080-rotated" });
  });

  it("reports failures by category only", () => {
    const send = vi.fn();
    trackExportFailed({ mode: "full", reason: "encoder_failed" }, send);
    expect(send).toHaveBeenCalledWith("Export failed", { mode: "full", reason: "encoder_failed" });
  });
});
