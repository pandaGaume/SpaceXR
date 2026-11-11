import type { FetchFunction } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { MAPZEN_TERRARIUM_ATTRIBUTION, createMapzenTerrariumSource } from "../src";

describe("DEM presets", () => {
    it("creates the Mapzen Terrarium preset", async () => {
        const urls: string[] = [];
        const fetch: FetchFunction = (url) => {
            urls.push(url);
            return Promise.resolve(new Response("png", { status: 200 }));
        };
        const { source, encoding } = createMapzenTerrariumSource({ client: { fetch } });
        expect(encoding).toBe("terrarium");
        expect(source.attribution).toBe(MAPZEN_TERRARIUM_ATTRIBUTION);
        expect(source.metrics.maxLOD).toBe(15);
        await source.fetchTile({ lod: 15, x: 9634, y: 11218 });
        expect(urls[0]).toBe("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/15/9634/11218.png");
        expect(() => source.urlOf({ lod: 16, x: 0, y: 0 })).toThrow(RangeError);
    });
});
