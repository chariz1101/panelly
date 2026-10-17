import { describe, expect, it } from "vitest";
import { DataStream } from "mp4box";
import { serializeCodecDescription } from "./demux";

/** A box that writes a header and payload the way mp4box's avcC/hvcC do. */
function fakeBox(payload: number[]) {
  return {
    write(stream: DataStream) {
      stream.writeUint32(8 + payload.length);
      stream.writeUint8Array(new Uint8Array([0x61, 0x76, 0x63, 0x43])); // "avcC"
      stream.writeUint8Array(new Uint8Array(payload));
    },
  };
}

describe("serializeCodecDescription", () => {
  it("returns the box payload without its 8-byte header", () => {
    const payload = [1, 0x64, 0, 0x1f, 0xff, 0xe1];
    expect(Array.from(serializeCodecDescription(fakeBox(payload)))).toEqual(payload);
  });
});
