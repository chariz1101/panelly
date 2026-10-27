import { EncodedPacketSink } from "mediabunny";
import { MAX_DURATION_MS } from "@/lib/geometry/output";
import { UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/import/codecSupport";
import { openVideoTrack } from "@/lib/import/openVideoTrack";
import { isPastWindow, secondsToMicroseconds } from "./demuxMath";

/** One video panel's compressed stream, ready to feed a `VideoDecoder` (SPEC §6.1.1). */
export interface DemuxedVideo {
  config: VideoDecoderConfig;
  chunks: EncodedVideoChunk[];
  /** Display rotation in degrees clockwise; decoded frames are NOT pre-rotated. */
  rotation: number;
}

/** Thrown for any file this demuxer can't turn into decodable chunks. */
export class DemuxError extends Error {
  constructor(message = UNSUPPORTED_VIDEO_MESSAGE) {
    super(message);
    this.name = "DemuxError";
  }
}

/**
 * Demux the main video track of an MP4, MOV, WebM or MKV file with Mediabunny
 * into `EncodedVideoChunk`s plus the `VideoDecoderConfig` they need (SPEC
 * §6.1.1). Works for every codec Mediabunny reads (H.264, HEVC, VP8, VP9, AV1).
 * Only packets needed for the first `maxDurationMs` are kept, so a long clip
 * never has much more than 15 s of compressed data in memory.
 */
export async function demuxVideo(
  file: File,
  maxDurationMs: number = MAX_DURATION_MS,
): Promise<DemuxedVideo> {
  const { track, dispose } = await openVideoTrack(file);
  try {
    if (!track) throw new DemuxError();
    const config = await track.getDecoderConfig().catch(() => null);
    if (!config) throw new DemuxError();

    const first = await track.getFirstTimestamp();
    const packets: Array<{
      type: "key" | "delta";
      timestamp: number;
      duration: number;
      data: Uint8Array;
    }> = [];
    for await (const packet of new EncodedPacketSink(track).packets()) {
      if (packet.isMetadataOnly) continue;
      if (packets.length > 0 && isPastWindow(packet, first, maxDurationMs)) break;
      packets.push(packet);
    }
    if (!packets.some((p) => p.type === "key")) throw new DemuxError();

    // Presentation times can start above zero (B-frames, edit lists); shift so the
    // clip starts at 0, which is what the frame cursor and looping math assume.
    const origin = Math.min(...packets.map((p) => p.timestamp));
    const chunks = packets.map(
      (p) =>
        new EncodedVideoChunk({
          type: p.type,
          timestamp: secondsToMicroseconds(p.timestamp - origin),
          duration: secondsToMicroseconds(p.duration),
          data: p.data,
        }),
    );

    return { config, chunks, rotation: track.rotation };
  } catch (err) {
    throw err instanceof DemuxError ? err : new DemuxError();
  } finally {
    dispose();
  }
}
