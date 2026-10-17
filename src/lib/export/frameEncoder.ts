import { MAX_ENCODE_QUEUE } from "./encoderConfig";
import type { FrameSink } from "./frameLoop";

export type ChunkHandler = (
  chunk: EncodedVideoChunk,
  meta: EncodedVideoChunkMetadata | undefined,
) => void;

/** The slice of `VideoEncoder` the sink uses, so tests can fake it. */
export interface EncoderLike {
  readonly encodeQueueSize: number;
  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void;
  flush(): Promise<void>;
  close(): void;
  addEventListener(type: "dequeue", listener: () => void, options?: { once: boolean }): void;
}

/**
 * Resolve once the encoder's queue is at or below `max`. Waits on `dequeue`
 * events; the timer is a safety net for browsers that don't fire them.
 */
export async function waitForQueue(
  encoder: Pick<EncoderLike, "encodeQueueSize" | "addEventListener">,
  max = MAX_ENCODE_QUEUE,
): Promise<void> {
  while (encoder.encodeQueueSize > max) {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, 20);
      encoder.addEventListener("dequeue", finish, { once: true });
    });
  }
}

/**
 * `FrameSink` backed by a `VideoEncoder`. Applies backpressure before each
 * `encode()` (SPEC §6.2) and surfaces encoder errors on the next call.
 */
export class FrameEncoder implements FrameSink {
  constructor(
    private readonly encoder: EncoderLike,
    private readonly errors: Error[] = [],
  ) {}

  /** Build a real encoder; `onChunk` feeds the muxer (4.7). */
  static create(config: VideoEncoderConfig, onChunk: ChunkHandler): FrameEncoder {
    const errors: Error[] = [];
    const encoder = new VideoEncoder({ output: onChunk, error: (e) => errors.push(e) });
    encoder.configure(config);
    return new FrameEncoder(encoder, errors);
  }

  async encode(frame: VideoFrame, index: number): Promise<void> {
    this.throwIfFailed();
    await waitForQueue(this.encoder);
    this.throwIfFailed();
    // Keyframe every second so the file seeks and scrubs well.
    this.encoder.encode(frame, { keyFrame: index % 30 === 0 });
  }

  /** Encode everything still queued. */
  async flush(): Promise<void> {
    await this.encoder.flush();
    this.throwIfFailed();
  }

  close(): void {
    if (this.errors.length === 0) this.encoder.close();
  }

  private throwIfFailed() {
    const [failure] = this.errors;
    if (failure) throw failure;
  }
}
