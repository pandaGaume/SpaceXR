import type { IMetadataSchema, ITileset } from "@spacexr/3d-tiles-core";
import { describe, expect, it } from "vitest";

import { MetadataResolver } from "../src";

const schema: IMetadataSchema = {
    id: "Mining",
    enums: {
        Status: {
            values: [
                { name: "INFERRED", value: 0 },
                { name: "INDICATED", value: 1 },
            ],
        },
    },
    classes: {
        Deposit: {
            properties: {
                grade: {
                    type: "SCALAR",
                    componentType: "UINT8",
                    normalized: true,
                    scale: 10,
                    offset: 1,
                    required: true,
                    semantic: "ORE_GRADE",
                },
                status: { type: "ENUM", enumType: "Status" },
                quality: { type: "SCALAR", componentType: "FLOAT32", noData: -1, default: 42 },
                label: { type: "STRING", default: "Unnamed" },
            },
        },
    },
};

const tileset: ITileset = {
    asset: { version: "1.1" },
    geometricError: 100,
    schema,
    metadata: { class: "Deposit", properties: { grade: 64, status: "INFERRED" } },
    groups: [{ class: "Deposit", properties: { grade: 96, status: "INDICATED" } }],
    root: {
        boundingVolume: { sphere: [0, 0, 0, 10] },
        geometricError: 0,
        refine: "REPLACE",
        metadata: { class: "Deposit", properties: { grade: 128, quality: -1 } },
        content: {
            uri: "deposit.glb",
            group: 0,
            metadata: { class: "Deposit", properties: { grade: 192, status: "INDICATED" } },
        },
    },
};

describe("MetadataResolver", () => {
    it("keeps scopes separate and applies default, noData, normalization, scale and offset", () => {
        const resolver = new MetadataResolver();
        const snapshot = resolver.resolve({
            document: { uri: "https://example.test/tileset.json", tileset, schema, diagnostics: [] },
            tileId: "mine/root",
            tile: tileset.root,
            ancestors: [],
            content: tileset.root.content!,
            features: [{ id: "orebody-1", entity: { class: "Deposit", properties: { grade: 255, status: "INDICATED" } } }],
        });

        expect(snapshot.scopes.map((scope) => scope.scope)).toEqual(["tileset", "tile", "group", "content", "feature"]);
        const tileScope = snapshot.scopes.find((scope) => scope.scope === "tile");
        expect(tileScope?.properties.quality?.isNoData).toBe(true);
        expect(tileScope?.properties.quality?.fromDefault).toBe(true);
        expect(tileScope?.properties.quality?.value).toBe(42);
        expect(tileScope?.properties.label?.fromDefault).toBe(true);
        expect(tileScope?.properties.label?.value).toBe("Unnamed");

        const grade = resolver.findBySemantic(snapshot, "ORE_GRADE");
        expect(grade?.value).toBe(11);
        expect(snapshot.diagnostics).toEqual([]);
    });

    it("reports missing classes, invalid values and invalid group references without discarding raw metadata", () => {
        const resolver = new MetadataResolver();
        const invalidTileset: ITileset = {
            ...tileset,
            root: {
                ...tileset.root,
                metadata: { class: "Missing", properties: { custom: "kept" } },
                content: { uri: "deposit.glb", group: 8, metadata: { class: "Deposit", properties: { grade: "bad" } } },
            },
        };
        const snapshot = resolver.resolve({
            document: { uri: "https://example.test/tileset.json", tileset: invalidTileset, schema, diagnostics: [] },
            tileId: "mine/root",
            tile: invalidTileset.root,
            ancestors: [],
            content: invalidTileset.root.content!,
        });

        expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
            expect.arrayContaining([
                "METADATA_CLASS_UNKNOWN",
                "METADATA_PROPERTY_UNKNOWN",
                "METADATA_GROUP_OUT_OF_RANGE",
                "METADATA_PROPERTY_TYPE",
            ]),
        );
        expect(snapshot.scopes.find((scope) => scope.scope === "tile")?.properties.custom?.rawValue).toBe("kept");
    });

    it("resolves ancestor and feature metadata against the schema that owns each entity", () => {
        const resolver = new MetadataResolver();
        const ancestorSchema: IMetadataSchema = {
            id: "Mine",
            classes: { MineSite: { properties: { name: { type: "STRING" } } } },
        };
        const featureSchema: IMetadataSchema = {
            id: "MeshFeatures",
            classes: { OreBody: { properties: { tonnage: { type: "SCALAR", componentType: "FLOAT64" } } } },
        };
        const ancestorTileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 1,
            schema: ancestorSchema,
            root: {
                boundingVolume: { sphere: [0, 0, 0, 1] },
                geometricError: 0,
                metadata: { class: "MineSite", properties: { name: "North pit" } },
            },
        };
        const snapshot = resolver.resolve({
            document: { uri: "https://example.test/external/tileset.json", tileset, schema, diagnostics: [] },
            tileId: "mine/root/external/root",
            tile: tileset.root,
            ancestors: [
                {
                    id: "mine/root",
                    tile: ancestorTileset.root,
                    document: {
                        uri: "https://example.test/tileset.json",
                        tileset: ancestorTileset,
                        schema: ancestorSchema,
                        diagnostics: [],
                    },
                },
            ],
            features: [
                {
                    id: "orebody-1",
                    sourceUri: "https://example.test/external/deposit.glb",
                    schema: featureSchema,
                    entity: { class: "OreBody", properties: { tonnage: 125000 } },
                },
            ],
        });

        const ancestor = snapshot.scopes.find((scope) => scope.scope === "ancestor-tile");
        const feature = snapshot.scopes.find((scope) => scope.scope === "feature");
        expect(ancestor?.documentUri).toBe("https://example.test/tileset.json");
        expect(ancestor?.classDefinition).toBe(ancestorSchema.classes?.MineSite);
        expect(feature?.documentUri).toBe("https://example.test/external/deposit.glb");
        expect(feature?.classDefinition).toBe(featureSchema.classes?.OreBody);
        expect(snapshot.diagnostics.some((diagnostic) => diagnostic.code === "METADATA_CLASS_UNKNOWN")).toBe(false);
    });
});
