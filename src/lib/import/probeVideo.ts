import type { PanelMedia } from "@/types";
import { validateVideoDimensions } from "./validate";

/**
 * Loads a video file into an offscreen `<video>`, reads its size and duration
 * and returns a `PanelMedia` that owns a fresh object URL (SPEC §5.2). Videos
 * over 4096 px on either side are rejected (SPEC §5.3). The caller hands the
 * result to the store, which revokes the URL on replace/remove.
 */
export function probeVideo(file: File): Promise<PanelMedia> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  const release = () => {
    video.removeAttribute("src");
    video.load();
  };

  return new Promise((resolve, reject) => {
    const fail = (message: string) => {
      release();
      URL.revokeObjectURL(objectUrl);
      reject(new Error(message));
    };
    video.onloadedmetadata = () => {
      const { videoWidth: width, videoHeight: height, duration } = video;
      if (width === 0 || height === 0) {
        fail("That video has no size.");
        return;
      }
      const tooLarge = validateVideoDimensions({ width, height });
      if (tooLarge) {
        fail(tooLarge);
        return;
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        fail("That video has no readable length.");
        return;
      }
      release();
      resolve({
        kind: "video",
        file,
        objectUrl,
        naturalWidth: width,
        naturalHeight: height,
        durationMs: Math.round(duration * 1000),
        muted: true,
      });
    };
    video.onerror = () =>
      fail("That video couldn't be read. It may be corrupt or in an unsupported format.");
    video.src = objectUrl;
  });
}
