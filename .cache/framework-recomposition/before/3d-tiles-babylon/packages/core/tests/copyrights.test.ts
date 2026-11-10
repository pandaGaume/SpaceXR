import { describe, expect, it } from "vitest";

import { extractGltfCopyrights } from "../src";
import { createGlb, encodeJson } from "./helpers";

describe("extractGltfCopyrights", () => {
    it("splits and trims the attribution of a binary glTF asset", () => {
        const buffer = createGlb({ asset: { version: "2.0", copyright: "Google; Data provider ;Google" } });

        expect(extractGltfCopyrights(buffer)).toEqual(["Google", "Data provider", "Google"]);
    });

    it("reads the attribution of a JSON glTF asset", () => {
        const bytes = encodeJson({ asset: { version: "2.0", copyright: "Survey office" } });

        expect(extractGltfCopyrights(bytes.slice().buffer)).toEqual(["Survey office"]);
    });

    it("returns no attribution for malformed or missing metadata", () => {
        expect(extractGltfCopyrights(new ArrayBuffer(3))).toEqual([]);
        expect(extractGltfCopyrights(createGlb({ asset: { version: "2.0" } }))).toEqual([]);
        expect(extractGltfCopyrights(new TextEncoder().encode("not a glTF document").slice().buffer)).toEqual([]);
    });
});
