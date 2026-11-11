import { describe, expect, it } from "vitest";

import { detectTileContentFormat } from "../src";
import { createGlb, encodeJson } from "./helpers";

describe("detectTileContentFormat", () => {
    it("recognizes binary formats from their magic", () => {
        expect(detectTileContentFormat(new Uint8Array(createGlb({ asset: { version: "2.0" } })))).toBe("glb");
        for (const magic of ["b3dm", "i3dm", "pnts", "cmpt"]) {
            expect(detectTileContentFormat(new TextEncoder().encode(`${magic}\u0001\u0000\u0000\u0000`))).toBe(magic);
        }
    });

    it("distinguishes tilesets from glTF JSON without relying on an extension", () => {
        expect(detectTileContentFormat(encodeJson({ asset: { version: "1.1" }, geometricError: 0, root: {} }))).toBe("tileset");
        expect(detectTileContentFormat(encodeJson({ asset: { version: "2.0" }, scenes: [] }))).toBe("gltf");
        expect(detectTileContentFormat(new TextEncoder().encode('﻿ \n {"asset":{"version":"1.1"},"root":{}}'))).toBe("tileset");
    });

    it("reports unrecognized payloads", () => {
        expect(detectTileContentFormat(new Uint8Array())).toBe("unknown");
        expect(detectTileContentFormat(encodeJson([1, 2]))).toBe("unknown");
        expect(detectTileContentFormat(encodeJson({ type: "FeatureCollection" }))).toBe("unknown");
        expect(detectTileContentFormat(new TextEncoder().encode("{ truncated"))).toBe("unknown");
    });
});
