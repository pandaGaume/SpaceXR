import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { TilesetCodecError, TilesetJsonCodec, validateTileset } from "../src";

interface IFixtureCase {
    id: string;
    path: string;
    valid: boolean;
    expectedCodes: string[];
}

interface IFixtureManifest {
    suite: string;
    cases: IFixtureCase[];
}

const conformanceRoot = new URL("../../../../conformance/", import.meta.url);
const fixtureRoot = new URL("3d-tiles-1.1/", conformanceRoot);
const codec = new TilesetJsonCodec();

for (const suiteRoot of [fixtureRoot, new URL("SPACEXR_bounding_volume_utm/", conformanceRoot)]) {
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", suiteRoot), "utf8")) as IFixtureManifest;

    describe(manifest.suite, () => {
        for (const fixture of manifest.cases) {
            it(`${fixture.valid ? "accepts" : "rejects"} ${fixture.id}`, () => {
                const source = readFileSync(new URL(fixture.path, suiteRoot), "utf8");
                const json = JSON.parse(source) as unknown;
                const result = validateTileset(json);

                expect(result.valid).toBe(fixture.valid);
                const codes = [...new Set(result.diagnostics.map((diagnostic) => diagnostic.code))].sort();
                expect(codes).toEqual([...fixture.expectedCodes].sort());

                if (fixture.valid) {
                    const tileset = codec.decode(source);
                    expect(JSON.parse(codec.encode(tileset)) as unknown).toEqual(json);
                } else {
                    expect(() => codec.decode(source)).toThrow(TilesetCodecError);
                }
            });
        }
    });
}

describe("TilesetJsonCodec", () => {
    it("decodes UTF-8 bytes", () => {
        const source = readFileSync(new URL("positive/minimal-extensionless-content.json", fixtureRoot), "utf8");
        const tileset = codec.decode(new TextEncoder().encode(source));

        expect(tileset.asset.version).toBe("1.1");
        expect(tileset.root.content?.uri).toBe("content/resource");
    });

    it("can indent serialized JSON", () => {
        const source = readFileSync(new URL("positive/minimal-extensionless-content.json", fixtureRoot), "utf8");
        const encoded = codec.encode(codec.decode(source), { pretty: 2 });

        expect(encoded).toContain('\n  "asset"');
    });

    it("reports malformed JSON separately from validation errors", () => {
        try {
            codec.decode("{");
            throw new Error("Expected decoding to fail.");
        } catch (error) {
            expect(error).toBeInstanceOf(TilesetCodecError);
            expect((error as TilesetCodecError).diagnostics).toEqual([]);
        }
    });

    it("enforces normative implicit-root and template constraints", () => {
        const result = validateTileset({
            asset: { version: "1.1" },
            geometricError: 1,
            root: {
                boundingVolume: { sphere: [0, 0, 0, 1] },
                geometricError: 1,
                refine: "REPLACE",
                content: { uri: "content/{level}/{x}.glb", boundingVolume: { sphere: [0, 0, 0, 1] } },
                metadata: { class: "Invalid" },
                children: [{ boundingVolume: { sphere: [0, 0, 0, 1] }, geometricError: 0 }],
                implicitTiling: {
                    subdivisionScheme: "OCTREE",
                    subtreeLevels: 2,
                    availableLevels: 3,
                    subtrees: { uri: "subtrees/{level}/{x}/{y}.subtree" },
                },
            },
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
            expect.arrayContaining([
                "IMPLICIT_CHILDREN_FORBIDDEN",
                "IMPLICIT_METADATA_FORBIDDEN",
                "IMPLICIT_SPHERE_FORBIDDEN",
                "IMPLICIT_CONTENT_BOUNDING_VOLUME_FORBIDDEN",
                "INVALID_IMPLICIT_TEMPLATE",
            ])
        );
    });
});
