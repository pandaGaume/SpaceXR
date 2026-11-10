import type { GeodeticSystem } from "@spacexr/geodesy";
import type { ReferenceSurface } from "@spacexr/tiles";

import type { IEcefSpatialState, IVector3 } from "./ecef-types";

/**
 * The vertical exaggeration of a scene. Terrain, picking, tile bounds, the camera and objects read this one value, so
 * that they cannot disagree: changing it changes all of them.
 */
export class VerticalScale {
    private current: number;
    private readonly listeners = new Set<(value: number) => void>();

    /** @throws RangeError When the value is negative or not finite. */
    public constructor(value = 1) {
        this.current = VerticalScale.checked(value);
    }

    public get value(): number {
        return this.current;
    }

    /** Changes the scale and notifies the listeners when it differs. @throws RangeError When the value is negative or not finite. */
    public set(value: number): void {
        const next = VerticalScale.checked(value);
        if (next === this.current) return;
        this.current = next;
        for (const listener of [...this.listeners]) listener(next);
    }

    /** @returns The function that stops the notifications. */
    public subscribe(listener: (value: number) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private static checked(value: number): number {
        if (!Number.isFinite(value) || value < 0) throw new RangeError("The vertical scale must be non-negative and finite.");
        return value;
    }
}

/** What a height means on a body: the same as for the terrain under the objects. */
export interface IVerticalFrame {
    /** Height of a point in metres, over the surface the heights of the terrain refer to. */
    height(point: Readonly<IVector3>): number;
    /** Unit direction along which that height is measured at a point. */
    up(point: Readonly<IVector3>): IVector3;
}

/** Radial heights over a reference surface, as on the cube index: `P = (r_ref(d) + h) d`. */
export function radialVerticalFrame(reference: Pick<ReferenceSurface, "height">): IVerticalFrame {
    return {
        height: (point) => reference.height(point),
        up: (point) => {
            const length = Math.hypot(point.x, point.y, point.z) || 1;
            return { x: point.x / length, y: point.y / length, z: point.z / length };
        },
    };
}

/** Heights along the normal of an ellipsoid, as on the Web Mercator grid. */
export function geodeticVerticalFrame(system: GeodeticSystem): IVerticalFrame {
    return {
        height: (point) => system.ecefToGeodeticRadians(point).height,
        up: (point) => {
            const { latitude, longitude } = system.ecefToGeodeticRadians(point);
            const cosine = Math.cos(latitude);
            return { x: cosine * Math.cos(longitude), y: cosine * Math.sin(longitude), z: Math.sin(latitude) };
        },
    };
}

/** How objects follow the vertical scale of their scene. */
export interface IVerticalPlacement {
    scale: VerticalScale;
    frame: IVerticalFrame;
}

/**
 * How far the vertical scale moves an anchor: `h (s - 1)` along its up direction. A point of the terrain at height `h` is
 * moved exactly as far, so an object placed on the terrain stays on it. The object itself is moved, never stretched.
 */
export function verticalDisplacement(anchor: Readonly<IVector3> | undefined, placement: IVerticalPlacement): IVector3 {
    const factor = placement.scale.value - 1;
    // The centre of the body has no height: a volume around it does not move, it only grows.
    if (factor === 0 || !anchor || (anchor.x === 0 && anchor.y === 0 && anchor.z === 0)) return { x: 0, y: 0, z: 0 };
    const distance = placement.frame.height(anchor) * factor;
    const up = placement.frame.up(anchor);
    return { x: up.x * distance, y: up.y * distance, z: up.z * distance };
}

/**
 * The bounds of a tile under the vertical scale.
 *
 * The first tile with a position, from the root down, is an object: it moves by the height of its origin, and its
 * descendants move with it whatever their transforms, so that an object never comes apart. A tile above any object moves
 * with the centre of its volume. It may hold objects of other heights, whose origins differ from that height by at most its
 * radius: it grows by `r |s - 1|` to keep them inside. The transform stays as it was: children compose from the original
 * placement.
 */
export function placeVertically<TState extends IEcefSpatialState>(
    state: TState,
    placement: IVerticalPlacement,
    parent?: Readonly<IEcefSpatialState>,
): TState {
    const [x, y, z] = [state.worldTransform[12]!, state.worldTransform[13]!, state.worldTransform[14]!];
    const object = parent?.verticalObject ?? (x !== 0 || y !== 0 || z !== 0 ? { x, y, z } : undefined);
    const sphere = state.boundingSphere;
    const anchor = object ?? (sphere && { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z });
    const placed: TState = { ...state, ...(object ? { verticalObject: object } : {}), ...(anchor ? { verticalAnchor: anchor } : {}) };
    const factor = placement.scale.value - 1;
    if (factor === 0 || !sphere) return placed;
    const moved = verticalDisplacement(anchor, placement);
    const margin = object ? 0 : sphere.radius * Math.abs(factor);
    placed.boundingSphere = {
        center: { x: sphere.center.x + moved.x, y: sphere.center.y + moved.y, z: sphere.center.z + moved.z },
        radius: sphere.radius + margin,
    };
    if (state.boundingBox) {
        const { min, max } = state.boundingBox;
        placed.boundingBox = {
            min: { x: min.x + moved.x - margin, y: min.y + moved.y - margin, z: min.z + moved.z - margin },
            max: { x: max.x + moved.x + margin, y: max.y + moved.y + margin, z: max.z + moved.z + margin },
        };
    }
    return placed;
}
