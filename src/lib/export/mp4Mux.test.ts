import { beforeAll, describe, expect, it, vi } from "vitest";
import { Mp4Mux } from "./mp4Mux";

/** Just enough of an `EncodedVideoChunk` for the muxer to copy out (Node has no WebCodecs). */
class FakeChunk {
  readonly byteLength: number;
  constructor(
    readonly type: "key" | "delta",
    readonly timestamp: number,
    readonly duration: number,
    private readonly data: Uint8Array,
  ) {
    this.byteLength = data.length;
  }
  copyTo(dest: AllowSharedBufferSource) {
    new Uint8Array(dest as ArrayBuffer).set(this.data);
  }
}

beforeAll(() => {
  vi.stubGlobal("EncodedVideoChunk", FakeChunk);
});

const fakeChunk = (index: number, type: "key" | "delta") =>
  new FakeChunk(
    type,
    Math.round((index * 1_000_000) / 30),
    33_333,
    new Uint8Array([0, 0, 0, 2, 0x65, index]),
  ) as unknown as EncodedVideoChunk;

const meta: EncodedVideoChunkMetadata = {
  decoderConfig: {
    codec: "avc1.42001f",
    codedWidth: 1080,
    codedHeight: 1920,
    // Minimal avcC: version 1, baseline profile, one SPS, one PPS.
    description: new Uint8Array([
      1, 0x42, 0, 0x1f, 0xff, 0xe1, 0, 4, 0x67, 0x42, 0, 0x1f, 1, 0, 2, 0x68, 0xce,
    ]),
  },
};

const text = (bytes: Uint8Array, from: number) =>
  String.fromCharCode(...bytes.slice(from, from + 4));

describe("Mp4Mux", () => {
  const mux = () => {
    const m = new Mp4Mux();
    m.addChunk(fakeChunk(0, "key"), meta);
    m.addChunk(fakeChunk(1, "delta"), undefined);
    return m;
  };

  it("returns a video/mp4 blob with an ftyp header", async () => {
    const blob = mux().finish();
    expect(blob.type).toBe("video/mp4");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(text(bytes, 4)).toBe("ftyp");
  });

  it("puts moov before mdat so the file plays before it's fully buffered", async () => {
    const bytes = new Uint8Array(await mux().finish().arrayBuffer());
    const all = String.fromCharCode(...bytes);
    expect(all.indexOf("moov")).toBeGreaterThan(-1);
    expect(all.indexOf("moov")).toBeLessThan(all.indexOf("mdat"));
  });

  /** The 3×3 display matrix in the `tkhd` box, as 16.16 / 2.30 fixed-point integers. */
  const trackMatrix = (bytes: Uint8Array): number[] => {
    const at = String.fromCharCode(...bytes).indexOf("tkhd");
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    // tkhd (version 0): after the type come version/flags, times, track id,
    // reserved, duration, reserved, layer, group, volume, reserved: 40 bytes.
    const start = at + 4 + 40;
    return Array.from({ length: 9 }, (_, i) => view.getInt32(start + i * 4));
  };

  it("writes no rotation for an upright 1080×1920 file", async () => {
    const bytes = new Uint8Array(await mux().finish().arrayBuffer());
    expect(trackMatrix(bytes)).toEqual([0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000]);
  });

  it("writes a 90° clockwise rotation for a sideways 1920×1080 file", async () => {
    const m = new Mp4Mux({ width: 1920, height: 1080, rotation: 90 });
    m.addChunk(fakeChunk(0, "key"), meta);
    const bytes = new Uint8Array(await m.finish().arrayBuffer());
    const [a, b, , c, d] = trackMatrix(bytes);
    // [a b; c d] = [cos θ, sin θ; -sin θ, cos θ] for θ = 90°.
    expect([a, b, c, d]).toEqual([0, 0x10000, -0x10000, 0]);
  });

  it("refuses to finish twice and ignores chunks after finishing", () => {
    const m = mux();
    m.finish();
    expect(() => m.addChunk(fakeChunk(2, "delta"), undefined)).not.toThrow();
    expect(() => m.finish()).toThrow();
  });
});
