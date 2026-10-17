import { DataStream, Endianness, MP4BoxBuffer, createFile } from "mp4box";
import type { Box, Movie, Sample } from "mp4box";
import { MAX_DURATION_MS } from "@/lib/geometry/output";
import { UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/import/codecSupport";
import { isWithinWindow, rotationFromMatrix, toMicroseconds } from "./demuxMath";

const READ_BYTES = 4 * 1024 * 1024;
const BOX_HEADER_BYTES = 8;

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
 * The `description` a `VideoDecoderConfig` needs for avc1/hvc1 streams: the
 * `avcC`/`hvcC` box payload, i.e. the box serialized without its 8-byte header.
 */
export function serializeCodecDescription(box: Pick<Box, "write">): Uint8Array {
  const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
  (box as { write(s: DataStream): void }).write(stream);
  return new Uint8Array(stream.buffer, BOX_HEADER_BYTES, stream.getPosition() - BOX_HEADER_BYTES);
}

function codecDescription(sample: Sample | undefined): Uint8Array {
  const entry = sample?.description as { avcC?: Box; hvcC?: Box } | undefined;
  const box = entry?.avcC ?? entry?.hvcC;
  if (!box) throw new DemuxError();
  return serializeCodecDescription(box);
}

/**
 * Demux the first video track of an MP4/MOV with mp4box.js into
 * `EncodedVideoChunk`s plus a `VideoDecoderConfig` with its avcC/hvcC
 * description (SPEC §6.1.1). Only samples needed for the first `maxDurationMs`
 * are kept, so a long clip never has more than 15 s of compressed data in memory.
 */
export async function demuxVideo(
  file: File,
  maxDurationMs: number = MAX_DURATION_MS,
): Promise<DemuxedVideo> {
  const mp4 = createFile();
  const samples: Sample[] = [];
  let info: Movie | null = null;
  let failed = false;
  let reachedEnd = false;

  mp4.onError = () => {
    failed = true;
  };
  mp4.onReady = (movie) => {
    info = movie;
    const track = movie.videoTracks[0];
    if (!track) return;
    mp4.setExtractionOptions(track.id, null, { nbSamples: 100 });
    mp4.start();
  };
  mp4.onSamples = (id, _user, batch) => {
    for (const sample of batch) {
      if (isWithinWindow(sample.dts, sample.timescale, maxDurationMs)) {
        // Copy: mp4box reuses the buffer behind `data` once samples are released.
        samples.push({ ...sample, data: sample.data?.slice() });
      } else {
        reachedEnd = true;
      }
    }
    const last = batch[batch.length - 1];
    if (last) mp4.releaseUsedSamples(id, last.number + 1);
  };

  let offset = 0;
  while (!failed && !reachedEnd && offset < file.size) {
    const buffer = await file.slice(offset, offset + READ_BYTES).arrayBuffer();
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buffer, offset));
    offset = next > offset ? next : offset + buffer.byteLength;
  }
  mp4.flush();

  const movie = info as Movie | null;
  const track = movie?.videoTracks[0];
  const first = samples[0];
  if (failed || !track || !first?.data || !samples.some((s) => s.is_sync)) throw new DemuxError();

  // Presentation times can start above zero (B-frames, edit lists); shift so the
  // clip starts at 0, which is what the frame cursor and looping math assume.
  const origin = Math.min(...samples.map((s) => s.cts));
  const chunks = samples.map(
    (s) =>
      new EncodedVideoChunk({
        type: s.is_sync ? "key" : "delta",
        timestamp: toMicroseconds(s.cts - origin, s.timescale),
        duration: toMicroseconds(s.duration, s.timescale),
        data: s.data ?? new Uint8Array(0),
      }),
  );

  return {
    config: {
      codec: track.codec,
      codedWidth: track.video?.width ?? track.track_width,
      codedHeight: track.video?.height ?? track.track_height,
      description: codecDescription(first),
    },
    chunks,
    rotation: rotationFromMatrix(track.matrix),
  };
}
