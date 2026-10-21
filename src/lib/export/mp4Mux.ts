import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import type { EncodeSize } from "./encoderConfig";
import type { ChunkHandler } from "./frameEncoder";

/**
 * Collects encoded H.264 chunks into an MP4 (SPEC §6.1.5). `fastStart:
 * 'in-memory'` puts the `moov` box before the media data, so the file plays
 * before it has fully buffered. Video only: v1 ships silent (TASKS 4.11).
 */
export class Mp4Mux {
  private readonly target = new ArrayBufferTarget();
  private readonly muxer: Muxer<ArrayBufferTarget>;
  private finished = false;

  /** `size` is the encoder's output size, which may be below 1080×1920 on weaker phones. */
  constructor(size: EncodeSize = { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }) {
    this.muxer = new Muxer({
      target: this.target,
      video: { codec: "avc", width: size.width, height: size.height, frameRate: OUTPUT_FPS },
      fastStart: "in-memory",
    });
  }

  /** Pass to `FrameEncoder.create` as its `onChunk`. */
  readonly addChunk: ChunkHandler = (chunk, meta) => {
    if (this.finished) return;
    this.muxer.addVideoChunk(chunk, meta);
  };

  /** Write the file and return it. Call after the encoder has flushed. */
  finish(): Blob {
    if (this.finished) throw new Error("The video was already finished.");
    this.finished = true;
    this.muxer.finalize();
    return new Blob([this.target.buffer], { type: "video/mp4" });
  }
}
