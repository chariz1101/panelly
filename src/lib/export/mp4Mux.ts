import {
  BufferTarget,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import { OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import type { EncodeSize } from "./encoderConfig";
import type { ChunkHandler } from "./frameEncoder";

/**
 * Collects encoded H.264 chunks into an MP4 with Mediabunny (SPEC §6.1.5).
 * `fastStart: 'in-memory'` puts the `moov` box before the media data, so the
 * file plays before it has fully buffered. Video only: v1 ships silent (TASKS 4.11).
 */
export class Mp4Mux {
  private readonly target = new BufferTarget();
  private readonly output: Output<Mp4OutputFormat, BufferTarget>;
  private readonly source = new EncodedVideoPacketSource("avc");
  /** Every write runs after the one before it; the encoder's callback can't await. */
  private pending: Promise<void>;
  private failure: unknown = null;
  private finished = false;

  /**
   * `size` is the encoder's output size. On weaker phones it may be 1080×1920
   * stored sideways (written with a 90° rotation flag) or below 1080×1920.
   * Width and height come from the encoder's decoder config on the first chunk.
   */
  constructor(size: EncodeSize = { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }) {
    this.output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: this.target,
    });
    this.output.addVideoTrack(this.source, {
      rotation: size.rotation ?? 0,
      frameRate: OUTPUT_FPS,
    });
    this.pending = this.output.start().catch(this.fail);
  }

  /** Pass to `FrameEncoder.create` as its `onChunk`. */
  readonly addChunk: ChunkHandler = (chunk, meta) => {
    if (this.finished) return;
    // Copy the chunk's bytes now, while the encoder's callback still owns it.
    const packet = EncodedPacket.fromEncodedChunk(chunk);
    this.pending = this.pending.then(() => {
      if (this.failure === null) return this.source.add(packet, meta).catch(this.fail);
    });
  };

  /** Write the file and return it. Call after the encoder has flushed. */
  async finish(): Promise<Blob> {
    if (this.finished) throw new Error("The video was already finished.");
    this.finished = true;
    await this.pending;
    if (this.failure !== null) throw this.failure;
    await this.output.finalize();
    const buffer = this.target.buffer;
    if (!buffer) throw new Error("The video couldn't be written.");
    return new Blob([buffer], { type: "video/mp4" });
  }

  private readonly fail = (err: unknown) => {
    this.failure ??= err;
  };
}
