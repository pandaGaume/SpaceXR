import { PolylineSimplifier } from "../src/geometry/geometry.simplify";
import { Bounds, Cartesian3, Polygon } from "../src/geometry";
import { Line } from "../src/geometry/shapes/geometry.line";
import { Polyline } from "../src/geometry/shapes/geometry.polyline";
import { ShapeCollection } from "../src/tiles/geography/tiles.geography.collection";
import { EPSG3857 } from "../src/tiles/geography/tiles.geography.EPSG3857";
import { GeoPolyline } from "../src/geography/shapes/geography.polyline";
import { Geo2 } from "../src/geography/geography.position";
import { VectorTileFeatureBuilder } from "../src/tiles/vector/tiles.vector.feature.builder";
import { VectorTileFeature } from "../src/tiles/vector/tiles.vector.feature";
import { VectorTileLayer } from "../src/tiles/vector/tiles.vector.layer";
import { VectorTileGeomType } from "../src/tiles/vector/tiles.vector.interfaces";
import { TileVectorRenderer } from "../src/tiles/vector/tiles.vector.renderer";
import { LayerStyleTypes } from "../src/tiles/vector/tiles.vector.style.interface";
import { CanvasTileCodec } from "../src/tiles/codecs/tiles.codecs.canvas";
import { TileContentFetcher } from "../src/tiles/loaders/tiles.content.fetcher";
import { CacheEntryOptions, MemoryCache } from "../src/cache/cache";
import type { ITile, ITile2DAddress, ITileDatasource } from "../src/tiles/tiles.interfaces";

function context() {
    return {
        canvas: { width: 100, height: 100 },
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        closePath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
        arc: jest.fn(),
        setLineDash: jest.fn(),
    };
}

describe("vector tile preparation regressions", () => {
    it("preserves source geometry across repeated styles and uses translation in output pixels", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 100, y: 100 },
        ];
        const feature = new VectorTileFeature(1, VectorTileGeomType.LINESTRING, points);
        const layer = new VectorTileLayer("roads", 100, undefined, feature);
        const renderer = new TileVectorRenderer({
            layers: [
                {
                    sourceLayer: "roads",
                    type: LayerStyleTypes.Line,
                    paint: { color: "red", translate: [3, 4] },
                },
            ],
        });
        const ctx = context();
        for (let i = 0; i < 2; i++) renderer.renderTile({ layers: { roads: layer } }, ctx as unknown as CanvasRenderingContext2D, 200, 300);
        expect(points).toEqual([
            { x: 0, y: 0 },
            { x: 100, y: 100 },
        ]);
        expect(ctx.moveTo.mock.calls).toEqual([
            [3, 4],
            [3, 4],
        ]);
        expect(ctx.lineTo.mock.calls).toEqual([
            [203, 304],
            [203, 304],
        ]);
    });

    it("keeps every multipoint and honours its declared outline width", () => {
        const feature = new VectorTileFeature(1, VectorTileGeomType.POINT, [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
        ]);
        const renderer = new TileVectorRenderer({
            layers: [{ sourceLayer: "points", type: LayerStyleTypes.Circle, paint: { color: "red", radius: 2, strockeColor: "black", strockeWidth: 3 } }],
        });
        const ctx = context();
        renderer.renderTile({ layers: { points: new VectorTileLayer("points", 100, undefined, feature) } }, ctx as unknown as CanvasRenderingContext2D);
        expect(ctx.arc.mock.calls.map((args) => args.slice(0, 2))).toEqual([
            [10, 20],
            [30, 40],
        ]);
        expect((ctx as unknown as CanvasRenderingContext2D).lineWidth).toBe(3);
    });

    it("keeps polygon holes transparent regardless of ring winding and does not fill an outline-only style", () => {
        const ring = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ];
        const hole = [
            { x: 20, y: 20 },
            { x: 80, y: 20 },
            { x: 80, y: 80 },
            { x: 20, y: 80 },
        ];
        const tile = { layers: { area: new VectorTileLayer("area", 100, undefined, new VectorTileFeature(1, VectorTileGeomType.POLYGON, ring, hole)) } };
        const ctx = context();
        new TileVectorRenderer({ layers: [{ sourceLayer: "area", type: LayerStyleTypes.Fill, paint: { color: "red" } }] }).renderTile(
            tile,
            ctx as unknown as CanvasRenderingContext2D
        );
        expect(ctx.fill).toHaveBeenCalledWith("evenodd");
        expect(ctx.closePath).toHaveBeenCalledTimes(2);
        ctx.fill.mockClear();
        new TileVectorRenderer({ layers: [{ sourceLayer: "area", type: LayerStyleTypes.Fill, paint: { outlineColor: "black" } }] }).renderTile(
            tile,
            ctx as unknown as CanvasRenderingContext2D
        );
        expect(ctx.fill).not.toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it("builds an unclipped feature and owns its coordinate copies", () => {
        const start = new Cartesian3(10, 20, 0),
            end = new Cartesian3(30, 40, 0);
        const builder = new VectorTileFeatureBuilder(VectorTileGeomType.LINESTRING).withGeometry(new Line(start, end));
        const feature = builder.build(7);
        expect(feature.loadGeometry()).toEqual([
            [
                { x: 10, y: 20 },
                { x: 30, y: 40 },
            ],
        ]);
        feature.loadGeometry()[0][0].x = 99;
        expect(start.x).toBe(10);
        expect(builder.build().loadGeometry()[0][0].x).toBe(10);
    });

    it("preserves polygon holes when preparing a vector feature", () => {
        const polygon = Polygon.FromPoints([
            [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
            ].map(([x, y]) => new Cartesian3(x, y, 0)),
            [
                [2, 2],
                [8, 2],
                [8, 8],
                [2, 8],
            ].map(([x, y]) => new Cartesian3(x, y, 0)),
        ]);
        const feature = new VectorTileFeatureBuilder(VectorTileGeomType.POLYGON).withGeometry(polygon).build();
        expect(feature.loadGeometry()).toHaveLength(2);
        expect(feature.loadGeometry()[1]).toHaveLength(5);
    });

    it("accepts arbitrary slot names without changing their insertion order", () => {
        const renderer = new TileVectorRenderer({
            layers: [
                { sourceLayer: "roads", type: LayerStyleTypes.Line, slot: "10", paint: { color: "red" } },
                { sourceLayer: "roads", type: LayerStyleTypes.Line, slot: "2", paint: { color: "blue" } },
                { sourceLayer: "roads", type: LayerStyleTypes.Line, slot: "__proto__", paint: { color: "green" } },
            ],
        });
        const ctx = context();
        const colors: string[] = [];
        ctx.stroke.mockImplementation(() => {
            colors.push((ctx as unknown as CanvasRenderingContext2D).strokeStyle as string);
        });
        const feature = new VectorTileFeature(1, VectorTileGeomType.LINESTRING, [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
        ]);
        renderer.renderTile({ layers: { roads: new VectorTileLayer("roads", 100, undefined, feature) } }, ctx as unknown as CanvasRenderingContext2D);
        expect(colors).toEqual(["red", "blue", "green"]);
    });

    it("retains the portion crossing a tile when both segment ends are outside", () => {
        const line = Polyline.FromPoints([new Cartesian3(-10, 5, 0), new Cartesian3(20, 5, 30)]);
        const clipped = line.clip(new Bounds(0, 0, 10, 10));
        expect(clipped).toBeDefined();
        const part = Array.isArray(clipped) ? clipped[0] : clipped!;
        expect(Array.from(part)).toEqual([new Cartesian3(0, 5, 10), new Cartesian3(10, 5, 20)]);
        expect(line.points.map((p) => p.x)).toEqual([-10, 20]);
    });

    it("does not join separate visits to a tile and rejects a missed corner", () => {
        const bounds = new Bounds(0, 0, 10, 10);
        const points = [
            [5, 5],
            [15, 5],
            [15, 8],
            [5, 8],
        ].map(([x, y]) => new Cartesian3(x, y, 0));
        const parts = Polyline.FromPoints(points).clip(bounds);
        expect(Array.isArray(parts)).toBe(true);
        expect((parts as Polyline[]).map((part) => Array.from(part).map(({ x, y }) => [x, y]))).toEqual([
            [
                [5, 5],
                [10, 5],
            ],
            [
                [10, 8],
                [5, 8],
            ],
        ]);
        const miss = Polyline.FromPoints([new Cartesian3(-2, 9, 0), new Cartesian3(1, 12, 0)]);
        expect(miss.clip(bounds)).toBeUndefined();
        expect(new Line(new Cartesian3(-2, 9, 0), new Cartesian3(1, 12, 0)).clip(bounds)).toBeUndefined();
        const segment = new Line(new Cartesian3(-10, 5, 0), new Cartesian3(20, 5, 30)).clip(bounds);
        expect(Array.from(Array.isArray(segment) ? segment[0] : segment!)).toEqual([new Cartesian3(0, 5, 10), new Cartesian3(10, 5, 20)]);
    });

    it("rejects invalid LODs and retains a line whose first two projected points coincide", () => {
        const metrics = new EPSG3857({ minLOD: 1, maxLOD: 10 });
        const simplifier = new PolylineSimplifier<Cartesian3>();
        jest.spyOn(simplifier, "simplify").mockImplementation((points) => points);
        const collection = new ShapeCollection(metrics, simplifier);
        const line = new GeoPolyline([new Geo2(0, 0), new Geo2(0, 0), new Geo2(0, 10)]);
        for (const lod of [0, 11, 1.5, NaN]) expect(collection.trySet(lod, line)).toBe(false);
        expect(collection.trySet(2, line)).toBe(true);
        expect(collection.get(2)!.length).toBe(1);
        expect(collection.trySet(2, new GeoPolyline([]))).toBe(false);
    });

    it("applies pixel tolerance consistently and still simplifies in high-quality mode", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 5, y: 1.5 },
            { x: 10, y: 0 },
        ];
        const simplifier = new PolylineSimplifier();
        expect(simplifier.simplify(points, 2)).toEqual([points[0], points[2]]);
        expect(simplifier.simplify(points, 2, true)).toEqual([points[0], points[2]]);
        expect(simplifier.simplify(points, 1, true)).toEqual(points);
    });
});

describe("transparent tile lifecycle", () => {
    it("expires the correct tile, slides access time and invokes eviction callbacks", () => {
        jest.useFakeTimers();
        const cache = new MemoryCache<string, number>({ slidingExpiration: 100, threshold: 0 });
        const evicted = jest.fn();
        try {
            expect(cache.any()).toBe(false);
            cache.set("tile", 1, new CacheEntryOptions({ _slidingExpiration: 100, _callbacks: [evicted] }));
            jest.advanceTimersByTime(60);
            expect(cache.get("tile")).toBe(1);
            jest.advanceTimersByTime(60);
            expect(cache.contains("tile")).toBe(true);
            jest.advanceTimersByTime(50);
            expect(cache.contains("tile")).toBe(false);
            expect(evicted).toHaveBeenCalledTimes(1);
            expect(evicted.mock.calls[0][0].key).toBe("tile");
            cache.set("a", 1);
            cache.set("b", 2);
            cache.clear();
            expect([...cache.keys()]).toEqual([]);
            expect(jest.getTimerCount()).toBe(0);
        } finally {
            cache.dispose();
            jest.useRealTimers();
        }
    });

    it("clears each reused canvas and restores its state even when rendering fails", async () => {
        const ctx = { save: jest.fn(), restore: jest.fn(), resetTransform: jest.fn(), clearRect: jest.fn(), getImageData: jest.fn(() => ({})) };
        const bitmap = jest.fn(async () => ({}) as ImageBitmap);
        const previous = globalThis.createImageBitmap;
        globalThis.createImageBitmap = bitmap as unknown as typeof createImageBitmap;
        class Codec extends CanvasTileCodec<boolean> {
            fail = false;
            protected async _decodeDataAsync() {
                return true;
            }
            protected _render() {
                if (this.fail) throw new Error("draw failure");
            }
        }
        const codec = new Codec({ width: 256, height: 256, getContext: () => ctx } as unknown as HTMLCanvasElement);
        try {
            await codec.decodeAsync(new Response());
            await codec.decodeAsync(new Response());
            codec.fail = true;
            await expect(codec.decodeAsync(new Response())).rejects.toThrow("draw failure");
            expect(ctx.clearRect.mock.calls).toEqual(Array(3).fill([0, 0, 256, 256]));
            expect(ctx.restore).toHaveBeenCalledTimes(3);
            expect(bitmap).toHaveBeenCalledTimes(2);
        } finally {
            globalThis.createImageBitmap = previous;
        }
    });

    it("isolates shared source caches, caches the root tile and disposes only its own entries", async () => {
        const cache = new MemoryCache<string, string | null>();
        const source = (name: string) => ({ name, fetchAsync: jest.fn(async () => ({ ok: true, content: name })) }) as unknown as ITileDatasource<string, ITile2DAddress>;
        const a = new TileContentFetcher(source("a"), cache),
            b = new TileContentFetcher(source("b"), cache);
        const tile = () => ({ address: { quadkey: "", x: 0, y: 0, levelOfDetail: 0 }, content: null }) as unknown as ITile<string>;
        const first = tile(),
            second = tile();
        await Promise.all([new Promise<void>((r) => a.fetchContent(first, () => r())), new Promise<void>((r) => b.fetchContent(second, () => r()))]);
        expect(first.content).toBe("a");
        expect(second.content).toBe("b");
        expect(a.fetchContent(tile(), jest.fn()).content).toBe("a");
        expect(b.fetchContent(tile(), jest.fn()).content).toBe("b");
        a.dispose();
        expect(b.fetchContent(tile(), jest.fn()).content).toBe("b");
        b.dispose();
        cache.dispose();
    });
});
