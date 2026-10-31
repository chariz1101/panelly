import type { PanelSource } from "@/lib/render/drawPanel";
import type { DemuxedVideo } from "./demux";
import { framesToDrop, heldFrameSize, pickNearest, seekIndex } from "./frameCursor";

/**
 * Chunks allowed in the decoder's queue before the cursor waits for it to
 * drain. Together with frame pruning this keeps only a few decoded frames
 * alive at once (SPEC §10).
 */
const MAX_DECODE_QUEUE = 4;

/** A decoded frame the cursor holds, already upright and at its decode size. */
export interface HeldFrame {
  source: PanelSource;
  /** Microseconds from the start of the clip. */
  timestamp: number;
  close(): void;
}

export type FrameNormalizer = (frame: VideoFrame) => HeldFrame;

/** The slice of `VideoDecoder` the cursor uses, so tests can substitute a fake. */
export interface DecoderLike {
  readonly decodeQueueSize: number;
  ondequeue: ((event: Event) => void) | null;
  configure(config: VideoDecoderConfig): void;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

export type DecoderFactory = (init: {
  output: (frame: VideoFrame) => void;
  error: (error: Error) => void;
}) => DecoderLike;

const defaultDecoderFactory: DecoderFactory = (init) => new VideoDecoder(init);

/**
 * Turn raw decoder output into the frame the compositor draws: each frame is
 * drawn once into an upright bitmap at its decode size and the original is
 * closed straight away. That handles the container's rotation (which
 * `VideoDecoder` ignores) and the 4K downscale (SPEC §5.4).
 *
 * Frames are copied even when neither applies: Safari ignores the source
 * rectangle when drawing a `VideoFrame` (WebKit bug 260459), so a raw frame
 * would export with the user's zoom and pan dropped.
 */
export function createFrameNormalizer(rotation: number, scale: number): FrameNormalizer {
  let canvas: OffscreenCanvas | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | null = null;

  return (frame) => {
    const { width, height } = heldFrameSize(
      { width: frame.displayWidth, height: frame.displayHeight },
      rotation,
      scale,
    );
    if (!canvas || !ctx) {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Couldn't create a canvas to decode video.");
    }
    canvas.width = width;
    canvas.height = height;

    // Draw the frame un-rotated, then let the transform turn it upright.
    const quarterTurn = rotation % 180 !== 0;
    const drawW = quarterTurn ? height : width;
    const drawH = quarterTurn ? width : height;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(frame, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const timestamp = frame.timestamp;
    frame.close();
    const bitmap = canvas.transferToImageBitmap();
    return { source: bitmap, timestamp, close: () => bitmap.close() };
  };
}

export interface PanelDecoderOptions {
  rotation?: number;
  /** Decode downscale from SPEC §5.4 (0 < s <= 1). */
  scale?: number;
  createDecoder?: DecoderFactory;
  normalize?: FrameNormalizer;
}

/**
 * Decoder plus frame cursor for one video panel (SPEC §6.1.2). Targets must
 * move forward in time; a target that goes backwards (the clip looped) resets
 * the decoder and seeks to the keyframe at the start. Never holds more than a
 * few frames, closing each one as soon as the cursor has passed it.
 */
export class PanelDecoder {
  private readonly chunks: EncodedVideoChunk[];
  private readonly config: VideoDecoderConfig;
  private readonly decoder: DecoderLike;
  private readonly normalize: FrameNormalizer;
  private buffer: HeldFrame[] = [];
  private next = 0;
  private started = false;
  private flushed = false;
  private targetUs = 0;
  private failure: Error | null = null;
  private wake: (() => void) | null = null;
  private closed = false;

  constructor(video: DemuxedVideo, options: PanelDecoderOptions = {}) {
    this.chunks = video.chunks;
    this.config = video.config;
    this.normalize =
      options.normalize ?? createFrameNormalizer(options.rotation ?? 0, options.scale ?? 1);
    this.decoder = (options.createDecoder ?? defaultDecoderFactory)({
      output: (frame) => this.onOutput(frame),
      error: (error) => {
        this.failure = error;
        this.signal();
      },
    });
    this.decoder.ondequeue = () => this.signal();
  }

  /** Frames currently held, for tests and diagnostics. */
  get bufferedCount(): number {
    return this.buffer.length;
  }

  /**
   * The decoded frame nearest to `targetUs`. The returned source stays valid
   * until the next call, so draw it before asking for another.
   */
  async frameAt(targetUs: number): Promise<PanelSource> {
    if (this.closed) throw new Error("Decoder is closed.");
    if (!this.started || targetUs < this.targetUs) this.rewind(targetUs);
    this.targetUs = targetUs;
    this.prune();

    while (!this.hasReached(targetUs)) {
      if (this.failure) throw this.failure;
      if (this.next < this.chunks.length) {
        if (this.decoder.decodeQueueSize >= MAX_DECODE_QUEUE) {
          await new Promise<void>((resolve) => (this.wake = resolve));
          continue;
        }
        const chunk = this.chunks[this.next++];
        if (chunk) this.decoder.decode(chunk);
      } else if (!this.flushed) {
        this.flushed = true;
        await this.decoder.flush();
      } else {
        break; // end of clip: the last frame is the nearest one
      }
    }
    if (this.failure) throw this.failure;

    this.prune();
    const index = pickNearest(
      this.buffer.map((f) => f.timestamp),
      targetUs,
    );
    const held = this.buffer[index];
    if (!held) throw new Error("The video produced no frames.");
    return held.source;
  }

  /** Close every held frame and the decoder. Safe to call more than once. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.releaseFrames();
    this.decoder.ondequeue = null;
    this.wake?.();
    try {
      this.decoder.close();
    } catch {
      // Already closed by an error.
    }
  }

  private hasReached(targetUs: number): boolean {
    const last = this.buffer[this.buffer.length - 1];
    return !!last && last.timestamp >= targetUs;
  }

  private onOutput(frame: VideoFrame): void {
    if (this.closed) {
      frame.close();
      return;
    }
    try {
      this.buffer.push(this.normalize(frame));
      this.prune();
    } catch (err) {
      this.failure = err instanceof Error ? err : new Error("Couldn't decode the video.");
    }
    this.signal();
  }

  /** Close frames the cursor has passed. */
  private prune(): void {
    const drop = framesToDrop(
      this.buffer.map((f) => f.timestamp),
      this.targetUs,
    );
    for (const held of this.buffer.splice(0, drop)) held.close();
  }

  /** Reset the decoder and restart from the keyframe for `targetUs` (the loop point). */
  private rewind(targetUs: number): void {
    this.releaseFrames();
    if (this.started) this.decoder.reset();
    this.decoder.configure(this.config);
    this.next = seekIndex(this.chunks, targetUs);
    this.started = true;
    this.flushed = false;
    this.targetUs = targetUs;
  }

  private releaseFrames(): void {
    for (const held of this.buffer.splice(0)) held.close();
  }

  private signal(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }
}
