import { describe, expect, it } from "vitest";

import { GoogleTilesUriResolver } from "../src/google-tiles";

describe("GoogleTilesUriResolver", () => {
    it("routes the root document through the same-origin backend", () => {
        const resolver = new GoogleTilesUriResolver();

        expect(resolver.rootTilesetUri).toBe("/google-3d-tiles/v1/3dtiles/root.json");
        expect(resolver.resolve("model.glb", "https://example.test/tiles/")).toBe("https://example.test/tiles/model.glb");
    });

    it("preserves the Google session without exposing the API key", () => {
        const resolver = new GoogleTilesUriResolver();
        const resolved = resolver.resolve(
            "/v1/3dtiles/datasets/CgA/files/tile.glb?session=session-value",
            "https://tile.googleapis.com/v1/3dtiles/root.json",
        );

        expect(resolved).toBe("/google-3d-tiles/v1/3dtiles/datasets/CgA/files/tile.glb?session=session-value");
        expect(resolver.resolve("next.glb", "https://tile.googleapis.com/v1/3dtiles/datasets/CgA/files/")).toBe(
            "/google-3d-tiles/v1/3dtiles/datasets/CgA/files/next.glb?session=session-value",
        );
        expect(
            resolver.resolve(
                "/v1/3dtiles/datasets/CgA/files/local.glb?session=session-value",
                "http://127.0.0.1:4173/google-3d-tiles/v1/3dtiles/root.json",
            ),
        ).toBe("/google-3d-tiles/v1/3dtiles/datasets/CgA/files/local.glb?session=session-value");
    });
});
