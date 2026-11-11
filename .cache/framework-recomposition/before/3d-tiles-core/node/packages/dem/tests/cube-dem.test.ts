import { GeodeticSystem } from "@spacexr/geodesy";
import {
    CELESTIAL_CUBE_SCHEME,
    CelestialTileSource,
    CubeFace,
    CubeTileSurface,
    ReferenceSurface,
    TileHttpClient,
    WebMercatorTileSurface,
    cubeTileDirection,
    planetocentricDirection,
} from "@spacexr/tiles";
import { describe, expect, it, vi } from "vitest";

import { ChildHeightRanges, DemPyramid, cubeDemPyramid, cubeDemTileLoader, createHeightGrid, radialHeightOnRay, tileSurfaceNormal, type IDemDecoder } from "../src";

const MOON = new CubeTileSurface(ReferenceSurface.sphere(1737400));

const decoder = (height: (bytes: Uint8Array) => number, size = 3): IDemDecoder => ({
    decodeDem: vi.fn(async (bytes: Uint8Array) => createHeightGrid(size, size, new Float32Array(size * size).fill(height(bytes)))),
});

function dataset(overrides: Record<string, unknown> = {}): unknown {
    return {
        scheme: CELESTIAL_CUBE_SCHEME,
        body: "Moon",
        frame: "MOON_ME",
        referenceRadii: [1737400, 1737400, 1737400],
        content: "elevation",
        encoding: "terrarium",
        tileSize: 2,
        minLOD: 0,
        maxLOD: 1,
        subtrees: [{ face: 5, lod: 0, x: 0, y: 0, maxLOD: 3 }],
        tiles: "https://tiles.example.com/{face}/{z}/{x}/{y}.png",
        ...overrides,
    };
}

function sourceReturning(bytes: Uint8Array): { source: CelestialTileSource; fetchTile: ReturnType<typeof vi.fn> } {
    const client = new TileHttpClient();
    const fetchTile = vi.fn(async () => ({ status: "ok", bytes }) as never);
    vi.spyOn(client, "fetchTile").mockImplementation(fetchTile);
    return { source: new CelestialTileSource(dataset(), { client }), fetchTile };
}

describe("cube DEM tiles", () => {
    it("read the deepest tile at their place, without generating levels beside a subtree", async () => {
        const fetched: string[] = [];
        const client = new TileHttpClient();
        vi.spyOn(client, "fetchTile").mockImplementation(async (url: string) => {
            fetched.push(url);
            return { status: "ok", bytes: new Uint8Array([1]) } as never;
        });
        const source = new CelestialTileSource(dataset({ maxLOD: 1, subtrees: [{ face: 5, lod: 2, x: 0, y: 0, maxLOD: 3 }] }), { client });
        const pyramid = cubeDemPyramid(
            source,
            decoder(() => 7)
        );
        // Beside the subtree: the deepest level everywhere, not a generated tile of level 3.
        expect(pyramid.rasters.areaOf({ face: 1, lod: 3, x: 0, y: 0 }).ancestor).toEqual({ face: 1, lod: 1, x: 0, y: 0 });
        expect(pyramid.rasters.areaOf({ face: 5, lod: 3, x: 7, y: 7 }).ancestor.lod).toBe(1);
        // Inside it: its own level, and beyond it the deepest tile there.
        expect(pyramid.rasters.areaOf({ face: 5, lod: 3, x: 0, y: 0 }).ancestor.lod).toBe(3);
        expect(pyramid.rasters.areaOf({ face: 5, lod: 5, x: 0, y: 0 }).ancestor.lod).toBe(3);
        await pyramid.tileHeights({ face: 1, lod: 3, x: 0, y: 0 });
        expect(fetched).toEqual(["https://tiles.example.com/1/1/0/0.png"]);
        // Heights are read at the level of the place, inside or outside the subtree.
        expect(pyramid.heightAt(0.1, 0.1, 3, 1)).toBe(7);
    });

    it("decode the tiles of a dataset with its encoding", async () => {
        const { source } = sourceReturning(new Uint8Array([9]));
        const dem = decoder((bytes) => bytes[0]!);
        const load = cubeDemTileLoader(source, dem);
        expect((await load({ face: 5, lod: 2, x: 1, y: 1 }))?.width).toBe(3);
        expect(dem.decodeDem).toHaveBeenCalledWith(new Uint8Array([9]), "terrarium", undefined);
        expect(await load({ face: 1, lod: 3, x: 0, y: 0 })).toBeUndefined();
    });

    it("rejects a dataset that holds no heights", () => {
        const source = new CelestialTileSource(dataset({ content: "imagery", encoding: "png" }));
        expect(() =>
            cubeDemTileLoader(
                source,
                decoder(() => 0)
            )
        ).toThrow(RangeError);
    });

    it("fill the tiles a sparse dataset does not declare from their parents", async () => {
        const { source, fetchTile } = sourceReturning(new Uint8Array([40]));
        const pyramid = cubeDemPyramid(
            source,
            decoder((bytes) => bytes[0]!),
            { maxLOD: 5 }
        );
        expect(pyramid.maxLOD).toBe(5);

        // Below the subtree of face 5, interpolated from its deepest declared level.
        const deep = await pyramid.tileHeights({ face: CubeFace.South, lod: 5, x: 3, y: 4 });
        expect(deep?.sampler(0.5, 0.5)).toBe(40);
        expect(fetchTile).toHaveBeenCalledWith("https://tiles.example.com/5/3/0/1.png", expect.any(AbortSignal));
        expect(fetchTile).not.toHaveBeenCalledWith("https://tiles.example.com/5/4/1/2.png", expect.any(AbortSignal));

        // Face 1 only declares levels 0 and 1.
        fetchTile.mockClear();
        const sparse = await pyramid.tileHeights({ face: CubeFace.PositiveY, lod: 3, x: 2, y: 2 });
        expect(sparse?.sampler(0, 0)).toBe(40);
        expect(fetchTile).toHaveBeenCalledTimes(1);
        expect(fetchTile).toHaveBeenCalledWith("https://tiles.example.com/1/1/0/0.png", expect.any(AbortSignal));
    });

    it("read heights on the face of the point, the stitched samples at their place", async () => {
        const pyramid = new DemPyramid({
            registration: "point",
            maxLOD: 1,
            load: async (address) => createHeightGrid(3, 3, new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => value + 10 * (address.face ?? 0)))),
        });
        await pyramid.tileHeights({ face: 2, lod: 1, x: 0, y: 0 });
        expect(pyramid.heightAt(0.25, 0.25, 1, 2)).toBe(24);
        expect(pyramid.heightAt(0.5, 0.5, 1, 2)).toBe(28);
        expect(pyramid.heightAt(0.25, 0.25, 1, 3)).toBeNaN();
        expect(pyramid.surfaceHeight(0.25, 0.25, [1], 2)).toBe(24);
        expect(pyramid.surfaceGradient(0.25, 0.25, [1], 2, 2)).toEqual([4, 12]);
        expect(pyramid.surfaceGradient(0.25, 0.25, [1], 2, 3)).toBeUndefined();
    });
});

describe("ChildHeightRanges", () => {
    it("keeps the tiles of different faces apart", () => {
        const ranges = new ChildHeightRanges();
        const range = { minimum: -5, maximum: 9 };
        ranges.recordChildren({ face: 3, lod: 1, x: 0, y: 0 }, [range, range, range, range]);
        expect(ranges.rangeFor({ face: 3, lod: 2, x: 1, y: 1 })).toEqual([-5, 9]);
        expect(ranges.rangeFor({ face: 4, lod: 2, x: 1, y: 1 })).toBeUndefined();
        expect(ranges.rangeFor({ lod: 2, x: 1, y: 1 })).toBeUndefined();
    });
});

describe("tileSurfaceNormal", () => {
    it("is the up vector of a flat surface, on any face and on Web Mercator", () => {
        const flat = (): number => 0;
        for (const face of [0, 1, 2, 3, 4, 5]) {
            const address = { face, lod: 4, x: 7, y: 9 };
            const normal = tileSurfaceNormal(MOON, address, 0.25, 0.75, 1 / 16, flat);
            const up = MOON.up(address, 0.25, 0.75);
            expect(Math.hypot(normal.x - up.x, normal.y - up.y, normal.z - up.z)).toBeLessThan(1e-6);
        }
        const earth = new WebMercatorTileSurface();
        const address = { lod: 6, x: 20, y: 25 };
        const normal = tileSurfaceNormal(earth, address, 0.5, 0.5, 1 / 16, flat);
        const up = earth.up(address, 0.5, 0.5);
        expect(Math.hypot(normal.x - up.x, normal.y - up.y, normal.z - up.z)).toBeLessThan(1e-3);
    });

    it("leans away from a rising slope", () => {
        // Near the centre of the south face: heights rise along u by 1 metre per metre.
        const address = { face: CubeFace.South, lod: 11, x: 1024, y: 1024 };
        const size = (Math.PI / 2) * (1737400 / 2048);
        const normal = tileSurfaceNormal(MOON, address, 0.5, 0.5, 1 / 16, (u) => u * size);
        const up = MOON.up(address, 0.5, 0.5);
        const east = { x: 0, y: 1, z: 0 };
        const cosine = normal.x * up.x + normal.y * up.y + normal.z * up.z;
        expect(cosine).toBeCloseTo(Math.SQRT1_2, 3);
        // On the south face, u grows along +Y: the normal leans toward -Y.
        expect(normal.x * east.x + normal.y * east.y + normal.z * east.z).toBeCloseTo(-Math.SQRT1_2, 3);
    });

    it("uses one-sided differences where heights are missing", () => {
        const address = { face: 0, lod: 2, x: 1, y: 1 };
        const normal = tileSurfaceNormal(MOON, address, 0, 0.5, 0.1, (u) => (u < 0 ? Number.NaN : 0));
        expect(Number.isFinite(normal.x)).toBe(true);
        expect(tileSurfaceNormal(MOON, address, 0.5, 0.5, 0.1, () => Number.NaN)).toEqual(MOON.up(address, 0.5, 0.5));
    });
});

describe("radialHeightOnRay", () => {
    const system = GeodeticSystem.WGS84;
    const reference = ReferenceSurface.fromEllipsoid(system.ellipsoid);

    it("finds the point of the relief on the ray", () => {
        const direction = planetocentricDirection(45, 30);
        const height = 8849;
        const radial = radialHeightOnRay(direction, reference, system, () => height);
        const geodetic = system.ecefToGeodeticRadians(reference.point(direction, radial));
        expect(geodetic.height).toBeCloseTo(height, 3);
        // Slightly longer along the ray than along the normal.
        expect(radial).toBeGreaterThan(height);
        expect(radial - height).toBeLessThan(0.1);
    });

    it("follows a relief varying with latitude", () => {
        const direction = cubeTileDirection({ face: CubeFace.North, lod: 4, x: 3, y: 9 }, 0.25, 0.75);
        const relief = (latitude: number): number => 3000 + 2000 * Math.sin(latitude * 200);
        const radial = radialHeightOnRay(direction, reference, system, (latitude) => relief(latitude), 5);
        const geodetic = system.ecefToGeodeticRadians(reference.point(direction, radial));
        expect(geodetic.height).toBeCloseTo(relief(geodetic.latitude), 1);
    });
});
