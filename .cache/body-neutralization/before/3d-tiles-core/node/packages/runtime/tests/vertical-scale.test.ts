import type { ITile, ITileset } from "@spacexr/3d-tiles-core";
import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { ReferenceSurface } from "@spacexr/tiles";
import { describe, expect, it, vi } from "vitest";

import {
    CameraChangeFlags,
    EcefSpatialMetric,
    TileRuntime,
    VerticalScale,
    geodeticVerticalFrame,
    radialVerticalFrame,
    verticalDisplacement,
    type IRuntimeAdapter,
} from "../src";

const R = 1737400;
const reference = ReferenceSurface.sphere(R);
const moon = new GeodeticSystem(Ellipsoid.fromAxes("Moon", R, R));

/** A tile on the +X axis, at a height over the reference surface, with a sphere around its origin. */
function tileAt(height: number, radius = 100): ITile {
    return {
        geometricError: 1,
        // prettier-ignore
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, R + height, 0, 0, 1],
        boundingVolume: { sphere: [0, 0, 0, radius] },
    };
}

describe("VerticalScale", () => {
    it("notifies its listeners of a change, once, until they leave", () => {
        const scale = new VerticalScale(2);
        const listener = vi.fn();
        const stop = scale.subscribe(listener);

        scale.set(2);
        expect(listener).not.toHaveBeenCalled();
        scale.set(3);
        expect(listener).toHaveBeenCalledExactlyOnceWith(3);
        stop();
        scale.set(4);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(scale.value).toBe(4);
    });

    it("refuses negative and non-finite values", () => {
        expect(() => new VerticalScale(-1)).toThrow(RangeError);
        expect(() => new VerticalScale().set(Number.NaN)).toThrow(RangeError);
    });
});

describe("the vertical displacement", () => {
    it("moves a point of the terrain to the exaggerated terrain, radially", () => {
        const scale = new VerticalScale(5);
        const height = 1200;
        const direction = { x: 0.6, y: 0, z: -0.8 };
        const anchor = { x: (R + height) * direction.x, y: 0, z: (R + height) * direction.z };
        const moved = verticalDisplacement(anchor, { scale, frame: radialVerticalFrame(reference) });

        expect(Math.hypot(anchor.x + moved.x, anchor.y + moved.y, anchor.z + moved.z)).toBeCloseTo(R + 5 * height, 6);
        expect(moved.x / moved.z).toBeCloseTo(direction.x / direction.z, 9);
    });

    it("moves along the normal of an ellipsoid with geodetic heights", () => {
        const system = GeodeticSystem.WGS84;
        const scale = new VerticalScale(3);
        const anchor = system.geodeticRadiansToEcef(Math.PI / 4, Math.PI / 18, 1000);
        const moved = verticalDisplacement(anchor, { scale, frame: geodeticVerticalFrame(system) });
        const after = system.ecefToGeodeticRadians({ x: anchor.x + moved.x, y: anchor.y + moved.y, z: anchor.z + moved.z });

        expect(after.height).toBeCloseTo(3000, 3);
        expect(after.latitude).toBeCloseTo(Math.PI / 4, 9);
    });

    it("leaves the centre of the body in place", () => {
        const moved = verticalDisplacement({ x: 0, y: 0, z: 0 }, { scale: new VerticalScale(3), frame: radialVerticalFrame(reference) });

        expect(moved).toEqual({ x: 0, y: 0, z: 0 });
    });
});

describe("EcefSpatialMetric with a vertical placement", () => {
    const placement = (value: number) => ({ scale: new VerticalScale(value), frame: radialVerticalFrame(reference) });

    it("reads the same lowest terrain as a fresh metric, once the scale comes back", () => {
        const scale = new VerticalScale(3);
        const frame = radialVerticalFrame(reference);
        const used = new EcefSpatialMetric({ geodeticSystem: moon, vertical: { scale, frame }, horizon: "tile-heights" });
        used.derive({ tile: tileAt(0), heightRange: [-3000, 0] });
        scale.set(1);
        const fresh = new EcefSpatialMetric({ geodeticSystem: moon, vertical: { scale, frame }, horizon: "tile-heights" });
        fresh.derive({ tile: tileAt(0), heightRange: [-1000, 0] });

        const lowest = (metric: EcefSpatialMetric) => (metric as unknown as { lowestUnscaledHeight: number }).lowestUnscaledHeight;
        expect(lowest(used)).toBeCloseTo(lowest(fresh), 9);
    });

    it("keeps the bounds of scale 1", () => {
        const placed = new EcefSpatialMetric({ geodeticSystem: moon, vertical: placement(1) }).derive({ tile: tileAt(1000) });
        const plain = new EcefSpatialMetric({ geodeticSystem: moon }).derive({ tile: tileAt(1000) });

        expect(placed.boundingSphere).toEqual(plain.boundingSphere);
        expect(placed.boundingBox).toEqual(plain.boundingBox);
    });

    it("moves an object by the height of its origin, without growing it, and leaves the transform for the children", () => {
        const metric = new EcefSpatialMetric({ geodeticSystem: moon, vertical: placement(4) });
        const state = metric.derive({ tile: tileAt(1000) });

        expect(state.boundingSphere?.center.x).toBeCloseTo(R + 4000, 6);
        expect(state.boundingSphere?.radius).toBe(100);
        expect(state.boundingBox?.max.x).toBeCloseTo(R + 4000 + 100, 6);
        expect(state.worldTransform[12]).toBe(R + 1000);
        expect(state.verticalAnchor).toEqual({ x: R + 1000, y: 0, z: 0 });
    });

    it("moves the parts of an object with it, whatever their transforms", () => {
        const metric = new EcefSpatialMetric({ geodeticSystem: moon, vertical: placement(10) });
        const parent = metric.derive({ tile: tileAt(1000, 500) });
        // In the frame of the parent, 400 m above its origin, then a tile without a transform below it.
        // prettier-ignore
        const part = metric.derive({ tile: { geometricError: 0, transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 400, 0, 0, 1], boundingVolume: { sphere: [0, 0, 0, 50] } }, parent });
        const below = metric.derive({ tile: { geometricError: 0, boundingVolume: { sphere: [0, 0, 0, 50] } }, parent: part });

        const moved = 1000 * 9;
        expect(part.boundingSphere!.center.x).toBeCloseTo(R + 1400 + moved, 6);
        expect(below.boundingSphere!.center.x).toBeCloseTo(R + 1400 + moved, 6);
        expect(part.verticalAnchor).toEqual({ x: R + 1000, y: 0, z: 0 });
    });

    it("moves the objects below a tile without a position by their own heights, inside its grown volume", () => {
        const metric = new EcefSpatialMetric({ geodeticSystem: moon, vertical: placement(10) });
        const site = metric.derive({ tile: { geometricError: 1, boundingVolume: { sphere: [R + 1000, 0, 0, 500] } } });
        const object = metric.derive({ tile: tileAt(1400, 50), parent: site });

        expect(object.boundingSphere!.center.x).toBeCloseTo(R + 14000, 6);
        const gap = Math.abs(object.boundingSphere!.center.x - site.boundingSphere!.center.x) + object.boundingSphere!.radius;
        expect(gap).toBeLessThanOrEqual(site.boundingSphere!.radius);
    });

    it("anchors a tile without a position at the centre of its volume", () => {
        const metric = new EcefSpatialMetric({ geodeticSystem: moon, vertical: placement(2) });
        const state = metric.derive({ tile: { geometricError: 1, boundingVolume: { sphere: [R + 1000, 0, 0, 10] } } });

        expect(state.boundingSphere?.center.x).toBeCloseTo(R + 2000, 6);
        expect(state.verticalAnchor).toEqual({ x: R + 1000, y: 0, z: 0 });
    });

    it("only grows a volume around the centre of the body", () => {
        const metric = new EcefSpatialMetric({ geodeticSystem: moon, vertical: placement(2) });
        const state = metric.derive({ tile: { geometricError: 1, boundingVolume: { sphere: [0, 0, 0, 2 * R] } } });

        expect(state.boundingSphere?.center).toEqual({ x: 0, y: 0, z: 0 });
        expect(state.boundingSphere?.radius).toBe(4 * R);
    });
});

describe("TileRuntime with a vertical scale", () => {
    interface ICamera {
        value: number;
    }
    interface ISpatial {
        volume: ITile["boundingVolume"];
    }
    const tileset: ITileset = {
        asset: { version: "1.1" },
        geometricError: 10,
        root: { geometricError: 0, boundingVolume: { sphere: [0, 0, 0, 1] }, content: { uri: "a.bin" } },
    };

    function runtimeOf(scale: VerticalScale, measured: ITile["boundingVolume"] | (() => ITile["boundingVolume"])) {
        const adapter: IRuntimeAdapter<ICamera, ISpatial, object, never> = {
            tilesets: { load: async () => ({ tileset }) },
            spatial: { derive: (context) => ({ volume: context.tile.boundingVolume }), isVisible: () => true, screenSpaceError: () => 0 },
            activation: {
                activate: async (context) => {
                    for (const content of context.pendingContents)
                        await context.readiness.ready(content.id, { kind: "renderable", handle: {}, tileBoundingVolume: measured });
                },
                deactivate: () => undefined,
            },
            presentation: { present: () => undefined, hide: () => undefined, release: () => undefined },
        };
        return new TileRuntime({ id: "scale", uri: "memory://tileset.json", adapter, verticalScale: scale });
    }

    async function settle(runtime: TileRuntime<ICamera, ISpatial, object, never>): Promise<void> {
        runtime.onCameraChanged({ value: 1 }, CameraChangeFlags.All);
        await runtime.processFrame();
        await runtime.whenIdle();
    }

    it("measures the content again when the scale changes, and asks for a frame", async () => {
        const scale = new VerticalScale(1);
        const runtime = runtimeOf(scale, () => ({ sphere: [0, 0, 0, 10 * scale.value] }));
        await settle(runtime);
        expect(runtime.root?.spatial.volume.sphere?.[3]).toBe(10);

        const origins: string[] = [];
        runtime.events.subscribe((event) => {
            if (event.type === "tile-bounds-refined") origins.push(event.origin);
        });
        expect(runtime.hasPendingWork).toBe(false);
        scale.set(3);
        expect(runtime.hasPendingWork).toBe(true);
        await runtime.processFrame();

        expect(runtime.root?.spatial.volume.sphere?.[3]).toBe(30);
        expect(origins).toEqual(["vertical-scale"]);
        await runtime.dispose();
    });

    it("gives the metric the heights measured on the content, again when the scale changes", async () => {
        const scale = new VerticalScale(1);
        const ranges: Array<readonly [number, number] | undefined> = [];
        const adapter: IRuntimeAdapter<ICamera, ISpatial, object, never> = {
            tilesets: { load: async () => ({ tileset }) },
            spatial: {
                derive: (context) => {
                    ranges.push(context.heightRange);
                    return { volume: context.tile.boundingVolume };
                },
                isVisible: () => true,
                screenSpaceError: () => 0,
            },
            activation: {
                activate: async (context) => {
                    for (const content of context.pendingContents)
                        await context.readiness.ready(content.id, {
                            kind: "renderable",
                            handle: {},
                            tileBoundingVolume: () => ({ sphere: [0, 0, 0, 10 * scale.value] }),
                            tileHeightRange: () => [-100 * scale.value, 200 * scale.value],
                        });
                },
                deactivate: () => undefined,
            },
            presentation: { present: () => undefined, hide: () => undefined, release: () => undefined },
        };
        const runtime = new TileRuntime({ id: "heights", uri: "memory://tileset.json", adapter, verticalScale: scale });
        await settle(runtime);
        // Unknown before the content loads, measured after.
        expect(ranges[0]).toBeUndefined();
        expect(ranges.at(-1)).toEqual([-100, 200]);

        scale.set(3);
        await runtime.processFrame();
        expect(ranges.at(-1)).toEqual([-300, 600]);
        await runtime.dispose();
    });

    it("keeps a volume measured once", async () => {
        const scale = new VerticalScale(1);
        const runtime = runtimeOf(scale, { sphere: [0, 0, 0, 7] });
        await settle(runtime);

        scale.set(3);
        await runtime.processFrame();

        expect(runtime.root?.spatial.volume.sphere?.[3]).toBe(7);
        await runtime.dispose();
    });

    it("stops following the scale once disposed", async () => {
        const scale = new VerticalScale(1);
        const runtime = runtimeOf(scale, { sphere: [0, 0, 0, 7] });
        await settle(runtime);
        await runtime.dispose();

        scale.set(3);

        expect(runtime.hasPendingWork).toBe(false);
    });
});
