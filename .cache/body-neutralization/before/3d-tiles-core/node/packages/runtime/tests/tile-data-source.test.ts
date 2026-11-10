import { describe, expect, it } from "vitest";

import { ImplicitTilesetDecorator, WebMapTileDataSource, WebMercatorTileMetrics } from "../src/implicit";

describe("tile data source metrics", () => {
    it("makes the source authoritative for LOD range, addressing and URLs", () => {
        const metrics = new WebMercatorTileMetrics({
            minLOD: 3,
            maxLOD: 12,
            tileSize: 256,
        });
        const dataSource = new WebMapTileDataSource({
            id: "terrain",
            metrics,
            rootAddress: { lod: 3, x: 4, y: 2 },
            urlTemplates: "https://terrain.test/{z}/{x}/{y}.png",
            minimumHeight: -500,
            maximumHeight: 9000,
        });
        const decorator = new ImplicitTilesetDecorator(dataSource, {
            subtreeLevels: 4,
        });

        expect(decorator.tileset.root.implicitTiling?.availableLevels).toBe(10);
        expect(dataSource.addressOf({ level: 9, x: 0, y: 0 })).toEqual({
            lod: 12,
            x: 2048,
            y: 1535,
        });
        expect(dataSource.resolve({ level: 9, x: 0, y: 0 }).contents[0]?.uri).toBe("https://terrain.test/12/2048/1535.png");
        // The ground size of the largest cell of the tile: its row nearest the equator.
        const largestCell = (lod: number, x: number, y: number): number => {
            const north = metrics.getTileXYToLatLon(x, y, lod).latitude;
            const south = metrics.getTileXYToLatLon(x, y + 1, lod).latitude;
            return metrics.groundResolution(north >= 0 && south <= 0 ? 0 : Math.min(Math.abs(north), Math.abs(south)), lod);
        };
        const root = dataSource.addressOf({ level: 0, x: 0, y: 0 });
        expect(dataSource.resolve({ level: 0, x: 0, y: 0 }).geometricError).toBeCloseTo(largestCell(root.lod, root.x, root.y));
        expect(dataSource.resolve({ level: 9, x: 0, y: 0 }).geometricError).toBeCloseTo(largestCell(12, 2048, 1535));
        expect(dataSource.resolve({ level: 9, x: 0, y: 0 }).geometricError).toBeLessThan(metrics.groundResolution(0, 12));
        expect(() => dataSource.addressOf({ level: 10, x: 0, y: 0 })).toThrow(/maxLOD 12/);
    });

    it("rejects an implicit root that disagrees with metrics.minLOD", () => {
        const metrics = new WebMercatorTileMetrics({ minLOD: 3, maxLOD: 12 });

        expect(
            () =>
                new WebMapTileDataSource({
                    metrics,
                    rootAddress: { lod: 4, x: 8, y: 4 },
                    urlTemplates: "https://terrain.test/{z}/{x}/{y}.png",
                }),
        ).toThrow(/metrics\.minLOD 3/);
    });

    it("expands subdomain, quadkey, TMS and application variables", () => {
        const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 5 });
        const dataSource = new WebMapTileDataSource({
            metrics,
            urlTemplates: ["https://{s}.imagery.test/{quadkey}.jpeg", "https://dem.test/{z}/{x}/{-y}.png?key={apiKey}"],
            subdomains: ["t0", "t1"],
            variables: { apiKey: "secret" },
        });
        // Implicit (3, 3, 2) is XYZ tile 3/3/5, quadkey 213.
        const uris = dataSource.resolve({ level: 3, x: 3, y: 2 }).contents.map((content) => content.uri);
        expect(uris).toEqual(["https://t0.imagery.test/213.jpeg", "https://dem.test/3/3/2.png?key=secret"]);
    });

    it("keeps {y} in the declared TMS convention", () => {
        const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 5 });
        const dataSource = new WebMapTileDataSource({ metrics, scheme: "TMS", urlTemplates: "https://tms.test/{z}/{x}/{y}/{quadkey}" });
        expect(dataSource.addressOf({ level: 3, x: 3, y: 2 })).toEqual({ lod: 3, x: 3, y: 2 });
        expect(dataSource.resolve({ level: 3, x: 3, y: 2 }).contents[0]?.uri).toBe("https://tms.test/3/3/2/213");
    });

    it("rejects templates with unknown variables at construction", () => {
        const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 5 });
        expect(() => new WebMapTileDataSource({ metrics, urlTemplates: "https://t/{zoom}/{x}/{y}" })).toThrow(/unknown variable \{zoom\}/);
    });
});
