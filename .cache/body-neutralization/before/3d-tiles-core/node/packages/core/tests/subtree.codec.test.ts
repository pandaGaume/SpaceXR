import type { ISubtree } from "../src";
import { SubtreeCodec, SubtreeCodecError } from "../src";
import { describe, expect, it } from "vitest";

const subtree: ISubtree = {
    buffers: [{ byteLength: 1 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 1 }],
    tileAvailability: { constant: 1 },
    contentAvailability: [{ bitstream: 0, availableCount: 3 }],
    childSubtreeAvailability: { constant: 0 },
};

describe("SubtreeCodec", () => {
    it("round-trips JSON subtree documents", () => {
        const codec = new SubtreeCodec();
        expect(codec.decode(codec.encodeJson(subtree)).subtree).toEqual(subtree);
    });

    it("round-trips binary subtree documents and their internal buffer", () => {
        const codec = new SubtreeCodec();
        const encoded = codec.encodeBinary(subtree, { binaryChunk: new Uint8Array([0b00010101]) });
        const decoded = codec.decode(encoded);

        expect(decoded.subtree).toEqual(subtree);
        expect([...decoded.binaryChunk!]).toEqual([0b00010101, 0, 0, 0, 0, 0, 0, 0]);
        expect(new TextDecoder().decode(encoded.subarray(0, 4))).toBe("subt");
    });

    it("rejects truncated binary subtree chunks", () => {
        const codec = new SubtreeCodec();
        const encoded = codec.encodeBinary(subtree, { binaryChunk: new Uint8Array([1]) });
        expect(() => codec.decode(encoded.subarray(0, encoded.length - 1))).toThrow(SubtreeCodecError);
    });
});
