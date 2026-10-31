import type { PanelMedia } from "@/types";
import { decodeScaleFor } from "./decodeScale";
import { validateVideoDimensions } from "./validate";
import { withTimeout } from "./withTimeout";

export const VIDEO_UNREADABLE_MESSAGE =
  "That video couldn't be read. It may be corrupt or in an unsupported format.";

/** How long the browser gets to report a video's size before it's read from the file instead. */
export const METADATA_TIMEOUT_MS = 5000;

/** What import needs to know about a video. */
export interface VideoInfo {
  width: number;
  height: number;
  durationSec: number;
}

export type ReadVideoInfo = (file: File) => Promise<VideoInfo | null>;

export interface ProbeVideoOptions {
  /** Reads the info via a `<video>` element; rejects if the browser can't play the file. */
  readFromElement?: (objectUrl: string) => { info: Promise<VideoInfo>; release: () => void };
  /** Reads the info from the file's container; `null` when it can't. */
  readFromFile?: ReadVideoInfo;
  timeoutMs?: number;
}

const usable = (info: VideoInfo) =>
  info.width > 0 && info.height > 0 && Number.isFinite(info.durationSec) && info.durationSec > 0;

/**
 * Checks a video's size and length and builds its `PanelMedia` (SPEC §5.2,
 * §5.3). Throws an `Error` with a user-facing message when it can't be used.
 */
export function videoMediaFrom(file: File, objectUrl: string, info: VideoInfo): PanelMedia {
  const { width, height, durationSec } = info;
  if (!(width > 0 && height > 0)) throw new Error("That video has no size.");
  const tooLarge = validateVideoDimensions({ width, height });
  if (tooLarge) throw new Error(tooLarge);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("That video has no readable length.");
  }
  return {
    kind: "video",
    file,
    objectUrl,
    naturalWidth: width,
    naturalHeight: height,
    durationMs: Math.round(durationSec * 1000),
    decodeScale: decodeScaleFor({ width, height }),
    muted: true,
  };
}

/** Size and length from an offscreen `<video>`, as the browser reports them. */
export function readVideoElement(objectUrl: string): {
  info: Promise<VideoInfo>;
  release: () => void;
} {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  const info = new Promise<VideoInfo>((resolve, reject) => {
    video.onloadedmetadata = () =>
      resolve({ width: video.videoWidth, height: video.videoHeight, durationSec: video.duration });
    video.onerror = () => reject(new Error(VIDEO_UNREADABLE_MESSAGE));
  });
  video.src = objectUrl;
  return {
    info,
    release: () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
    },
  };
}

/** Size (upright) and length read straight from the file's container with Mediabunny. */
export async function readVideoInfoFromFile(file: File): Promise<VideoInfo | null> {
  // Loaded on first use so the video reader isn't part of the initial page load.
  const { openVideoTrack } = await import("./openVideoTrack");
  const { track, dispose } = await openVideoTrack(file);
  try {
    if (!track) return null;
    return {
      width: track.displayWidth,
      height: track.displayHeight,
      durationSec: await track.computeDuration(),
    };
  } catch {
    return null;
  } finally {
    dispose();
  }
}

/**
 * Reads a video's size and duration and returns a `PanelMedia` that owns a
 * fresh object URL (SPEC §5.2). Videos over 4096 px on either side are
 * rejected (SPEC §5.3). The caller hands the result to the store, which
 * revokes the URL on replace/remove.
 *
 * The browser's `<video>` is asked first. iOS Safari sometimes never reports
 * the metadata for a picked video (seen with iPhone time-lapses and videos
 * edited in Photos), or reports no size or length, which used to leave the
 * import hanging with no message. In those cases the file's own container is
 * read instead, and if that fails too the user gets a message.
 */
export async function probeVideo(file: File, options: ProbeVideoOptions = {}): Promise<PanelMedia> {
  const {
    readFromElement = readVideoElement,
    readFromFile = readVideoInfoFromFile,
    timeoutMs = METADATA_TIMEOUT_MS,
  } = options;
  const objectUrl = URL.createObjectURL(file);
  const element = readFromElement(objectUrl);
  try {
    let info = await withTimeout<VideoInfo | null>(element.info, timeoutMs, () =>
      readFromFile(file),
    );
    if (info && !usable(info)) info = (await readFromFile(file)) ?? info;
    if (!info) throw new Error(VIDEO_UNREADABLE_MESSAGE);
    return videoMediaFrom(file, objectUrl, info);
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  } finally {
    element.release();
  }
}
