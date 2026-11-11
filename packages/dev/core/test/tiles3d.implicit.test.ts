import { ICameraViewState } from "../src/camera";
import { Ellipsoid } from "../src/geodesy";
import { GeodeticSystem } from "../src/geodesy/geodesy.system";
import { Bounds } from "../src/geometry/geometry.bounds";
import { IBoundingBox } from "../src/geometry";
import { EPSG3857 } from "../src/tiles/geography/tiles.geography.EPSG3857";
import { ITile3d } from "../src/tiles/3d/interfaces";
import { MetricsImplicitTilesetProvider, Tile3dStreamBinding, Tile3dStreamSource, TileContentStatus } from "../src/tiles/3d/engine";

const VIEW = "main";
const DEG = Math.PI / 180;
const SYS = new GeodeticSystem(Ellipsoid.WGS84);

// Paris.
const LAT = 48.8566;
const LON = 2.3522;

function cameraAt(lat: number, lon: number, altMeters: number): ICameraViewState {
    const eye = SYS.geodeticFloatToCartesianToRef(lat, lon, altMeters, { x: 0, y: 0, z: 0 });
    return {
        worldPosition: eye,
        worldRotation: { x: 0, y: 0, z: 0, w: 1 },
        fovY: Math.PI / 2,
        tanFov2: 1,
        viewportHeight: 1080,
    };
}

/** A small ECEF box around a geodetic point, used as a traversal clip column. */
function clipColumn(lat: number, lon: number, halfMeters: number): IBoundingBox {
    const s = SYS.geodeticFloatToCartesianToRef(lat, lon, 0, { x: 0, y: 0, z: 0 });
    return new Bounds(s.x - halfMeters, s.y - halfMeters, 2 * halfMeters, 2 * halfMeters, s.z - halfMeters, 2 * halfMeters);
}

function makeSource(availableLevels = 16, maxSSE = 16): Tile3dStreamSource {
    const provider = new MetricsImplicitTilesetProvider({
        metrics: new EPSG3857({ maxLOD: availableLevels - 1 }),
        contentUri: (l, x, y) => `https://tiles.example/${l}/${x}/${y}.png`,
        availableLevels,
    });
    return new Tile3dStreamSource({
        id: "mapzen",
        implicitProvider: provider,
        maxScreenSpaceError: maxSSE,
        horizonCull: false, // no frustum in these states; the clip column bounds the traversal
    });
}

/**
 * Drives the source to convergence: pushes the camera, then repeatedly marks
 * every cut tile's content ready and re-traverses, emulating the loader so the
 * hole-free REPLACE swaps descend level by level.
 */
function settle(source: Tile3dStreamSource, cam: ICameraViewState, clip: IBoundingBox, iters = 24): ReadonlyMap<string, ITile3d> {
    source.setContext(VIEW, cam, clip);
    for (let i = 0; i < iters; i++) {
        const cut = source.getActiveSources(VIEW)!;
        for (const s of cut.values()) {
            const t = s.content as ITile3d;
            if (t?.hasContent && t.contentStatus !== TileContentStatus.ready) {
                t.contentStatus = TileContentStatus.ready;
            }
        }
        source.invalidate();
    }
    const out = new Map<string, ITile3d>();
    for (const [id, s] of source.getActiveSources(VIEW)!) out.set(id, s.content as ITile3d);
    return out;
}

function maxLevel(cut: ReadonlyMap<string, ITile3d>): number {
    let m = -1;
    for (const t of cut.values()) m = Math.max(m, t.implicitCoords?.level ?? -1);
    return m;
}

function regionContains(region: [number, number, number, number, number, number], lonDeg: number, latDeg: number): boolean {
    const [w, s, e, n] = region;
    const lon = lonDeg * DEG;
    const lat = latDeg * DEG;
    return lon >= w - 1e-9 && lon <= e + 1e-9 && lat >= s - 1e-9 && lat <= n + 1e-9;
}

describe("MetricsImplicitTilesetProvider", () => {
    const provider = new MetricsImplicitTilesetProvider({
        metrics: new EPSG3857({ maxLOD: 15 }),
        contentUri: (l, x, y) => `https://tiles.example/${l}/${x}/${y}.png`,
    });

    it("derives availableLevels from the metrics maxLOD", () => {
        expect(provider.availableLevels).toBe(16);
        expect(provider.subdivisionScheme).toBe("QUADTREE");
    });

    it("computes the root region as the whole Web Mercator extent (radians)", () => {
        const r = provider.regionOf(0, 0, 0);
        expect(r[0]).toBeCloseTo(-Math.PI, 6); // west
        expect(r[2]).toBeCloseTo(Math.PI, 6); // east
        expect(r[3]).toBeCloseTo(85.0511 * DEG, 3); // north (Mercator clip)
        expect(r[1]).toBeCloseTo(-85.0511 * DEG, 3); // south
    });

    it("subdivides into four quadrants whose union is the parent", () => {
        const nw = provider.regionOf(1, 0, 0);
        const se = provider.regionOf(1, 1, 1);
        expect(nw[0]).toBeCloseTo(-Math.PI, 6); // NW west = parent west
        expect(nw[2]).toBeCloseTo(0, 6); // NW east = meridian
        expect(nw[3]).toBeCloseTo(85.0511 * DEG, 3); // NW north = parent north
        expect(nw[1]).toBeCloseTo(0, 6); // NW south = equator
        expect(se[0]).toBeCloseTo(0, 6); // SE west = meridian
        expect(se[2]).toBeCloseTo(Math.PI, 6); // SE east = parent east
        expect(se[1]).toBeCloseTo(-85.0511 * DEG, 3); // SE south = parent south
    });

    it("halves the geometric error each level", () => {
        const g0 = provider.geometricErrorOf(0, 0, 0);
        const g1 = provider.geometricErrorOf(1, 0, 0);
        const g2 = provider.geometricErrorOf(2, 0, 0);
        expect(g0 / g1).toBeCloseTo(2, 6);
        expect(g1 / g2).toBeCloseTo(2, 6);
        expect(g0).toBeGreaterThan(3.9e7); // ~Earth circumference at level 0
    });

    it("expands the content template", () => {
        expect(provider.contentUriOf(5, 16, 11)).toBe("https://tiles.example/5/16/11.png");
    });
});

describe("Tile3dStreamSource implicit traversal", () => {
    it("builds the root synchronously from the provider, no fetch", () => {
        const source = makeSource();
        let rootReady = false;
        source.rootReadyObservable.addOnce(() => (rootReady = true));
        source.setContext(VIEW, cameraAt(LAT, LON, 2e7), clipColumn(LAT, LON, 5000));
        expect(rootReady).toBe(true);
        expect(source.rootTileset?.root.implicitCoords).toEqual({ level: 0, x: 0, y: 0 });
    });

    it("materializes children lazily and only along the clip column", () => {
        const source = makeSource();
        const clip = clipColumn(LAT, LON, 3000);
        settle(source, cameraAt(LAT, LON, 1e6), clip);
        // Every emitted tile's region must contain Paris (the column is local).
        const cut = source.getActiveSources(VIEW)!;
        for (const s of cut.values()) {
            const t = s.content as ITile3d;
            expect(regionContains(t.boundingVolume.region!, LON, LAT)).toBe(true);
        }
        // The materialized tree stays tiny (a column, not the globe).
        expect(cut.size).toBeLessThan(40);
    });

    it("refines deeper as the camera descends and coarsens as it climbs", () => {
        const clip = clipColumn(LAT, LON, 2000);

        const high = makeSource();
        const cutHigh = settle(high, cameraAt(LAT, LON, 3_000_000), clip);
        const levelHigh = maxLevel(cutHigh);

        const low = makeSource();
        const cutLow = settle(low, cameraAt(LAT, LON, 4000), clip);
        const levelLow = maxLevel(cutLow);

        expect(levelLow).toBeGreaterThan(levelHigh);

        // Same source: descend then climb back, the leaf level must drop.
        const s = makeSource();
        const deep = maxLevel(settle(s, cameraAt(LAT, LON, 4000), clip));
        const shallow = maxLevel(settle(s, cameraAt(LAT, LON, 3_000_000), clip));
        expect(shallow).toBeLessThan(deep);
    });

    it("emits leaf tiles whose region contains the camera ground point", () => {
        const source = makeSource();
        const cut = settle(source, cameraAt(LAT, LON, 8000), clipColumn(LAT, LON, 2000));
        const leaves = Array.from(cut.values()).filter((t) => t.renderable);
        expect(leaves.length).toBeGreaterThan(0);
        expect(leaves.some((t) => regionContains(t.boundingVolume.region!, LON, LAT))).toBe(true);
    });

    it("stops subdividing at the last available level", () => {
        const source = makeSource(8); // levels 0..7
        const cut = settle(source, cameraAt(LAT, LON, 1000), clipColumn(LAT, LON, 2000));
        expect(maxLevel(cut)).toBeLessThanOrEqual(7);
        expect(maxLevel(cut)).toBe(7); // aggressive zoom reaches the floor
    });

    it("emits `removed` for every tile that leaves the cut when the camera climbs (coarsen cleanup)", () => {
        const source = makeSource();
        const clip = clipColumn(LAT, LON, 2000);
        const rec = { added: new Set<string>(), removed: new Set<string>() };
        source.linkTo({
            added: (batch: Iterable<{ content: ITile3d }>) => {
                for (const s of batch) rec.added.add(s.content.uid!);
            },
            removed: (batch: Iterable<{ content: ITile3d }>) => {
                for (const s of batch) rec.removed.add(s.content.uid!);
            },
            updated: () => {},
        } as never);

        settle(source, cameraAt(LAT, LON, 4000), clip); // deep
        const deep = new Set(source.getActiveSources(VIEW)!.keys());
        expect(deep.size).toBeGreaterThan(1);

        rec.added.clear();
        rec.removed.clear();
        settle(source, cameraAt(LAT, LON, 3_000_000), clip); // climb back out
        const shallow = new Set(source.getActiveSources(VIEW)!.keys());

        // Every tile that dropped out of the cut must have been announced as removed.
        const left = [...deep].filter((id) => !shallow.has(id));
        expect(left.length).toBeGreaterThan(0);
        for (const id of left) expect(rec.removed.has(id)).toBe(true);
        // And nothing that stayed should have been removed without re-adding.
        for (const id of shallow) if (rec.removed.has(id)) expect(rec.added.has(id)).toBe(true);
    });

    it("does not cascade levels within one frame when loads settle instantly", () => {
        // Regression: the binding used to call invalidate() on every settled
        // load, so each load re-ran the traversal in the SAME frame and opened
        // the next level, defeating maxRefinePerFrame. With a fast network or a
        // warm HTTP cache this activated thousands of tiles in one frame, which
        // froze navigation and made zoom respond seconds later.
        const provider = new MetricsImplicitTilesetProvider({
            metrics: new EPSG3857({ maxLOD: 16 }),
            contentUri: (l, x, y) => `t/${l}/${x}/${y}`,
            availableLevels: 17,
        });
        const source = new Tile3dStreamSource({ id: "t", implicitProvider: provider, maxScreenSpaceError: 24, horizonCull: false });

        let loads = 0;
        const observers: Array<(tiles: ITile3d[], state: unknown) => void> = [];
        const loader = {
            updatedObservable: {
                add(fn: (tiles: ITile3d[], state: unknown) => void) {
                    observers.push(fn);
                    return { disconnect() {} };
                },
            },
            load(tile: ITile3d) {
                loads++;
                if (loads > 5000) throw new Error(`runaway: ${loads} loads in one frame`);
                tile.contentStatus = TileContentStatus.ready; // instant content
                for (const fn of observers) fn([tile], {}); // notify synchronously
            },
            cancel() {},
            loadTileSetAsync: async () => null,
        };
        new Tile3dStreamBinding(source, loader as never);

        // Wide-open frustum at low altitude: the worst case for cascading.
        const cam = { ...cameraAt(LAT, LON, 500), isInFrustum: () => true };
        source.setContext(VIEW, cam);

        // One frame must do ONE traversal, so only the root level is opened.
        expect(loads).toBeLessThanOrEqual(4);
        expect(source.hasPendingWork).toBe(true); // and it asks to be pumped again
    });

    it("opens at most one level per refresh: a zoom does not materialize the whole subtree", () => {
        // Regression: children used to be materialized even while the REPLACE
        // gate was shut, so one deep zoom expanded level after level (4^n nodes
        // and content requests) in a single settle, stalling navigation.
        const source = makeSource(17);
        const clip = clipColumn(LAT, LON, 4000);
        const requested: string[] = [];
        source.linkTo({
            added: (batch: Iterable<{ content: ITile3d }>) => {
                for (const s of batch) if (s.content.hasContent) requested.push(s.content.uid!);
            },
            removed: () => {},
            updated: () => {},
        } as never);

        // Deep zoom, but NOTHING ever finishes loading: the traversal must stall
        // at the first unloaded front instead of drilling to the leaf level.
        source.setContext(VIEW, cameraAt(LAT, LON, 500), clip);
        for (let i = 0; i < 6; i++) source.invalidate();

        const sources = source.getActiveSources(VIEW)!;
        const cut = new Map<string, ITile3d>();
        for (const [id, s] of sources) cut.set(id, s.content as ITile3d);
        expect(maxLevel(cut)).toBeLessThanOrEqual(2); // root + one opened front
        expect(cut.size).toBeLessThan(12);
        expect(requested.length).toBeLessThan(12);
    });

    it("assigns stable hierarchical uids to materialized nodes", () => {
        const source = makeSource();
        settle(source, cameraAt(LAT, LON, 500_000), clipColumn(LAT, LON, 3000));
        const cut = source.getActiveSources(VIEW)!;
        for (const [id, s] of cut) {
            expect(id.startsWith("mapzen")).toBe(true);
            expect((s.content as ITile3d).uid).toBe(id);
        }
    });
});
