import type { GeodeticSystem } from "@spacexr/geodesy";
import type { Box, Region, Sphere } from "@spacexr/3d-tiles-core";

import type { IAxisAlignedBox, IBoundingSphere3, IEcefSpatialState, IVector3 } from "./ecef-types";
import { maximumScale, transformPoint, transformVector, vectorLength } from "./matrix";

export type EcefBounds = Pick<IEcefSpatialState, "boundingBox" | "boundingSphere">;

export function boundsFromBox(box: Box, matrix: Float64Array): EcefBounds {
    const center = transformPoint(matrix, { x: box[0], y: box[1], z: box[2] });
    const axes = [
        transformVector(matrix, { x: box[3], y: box[4], z: box[5] }),
        transformVector(matrix, { x: box[6], y: box[7], z: box[8] }),
        transformVector(matrix, { x: box[9], y: box[10], z: box[11] }),
    ];
    const extent = {
        x: Math.abs(axes[0]!.x) + Math.abs(axes[1]!.x) + Math.abs(axes[2]!.x),
        y: Math.abs(axes[0]!.y) + Math.abs(axes[1]!.y) + Math.abs(axes[2]!.y),
        z: Math.abs(axes[0]!.z) + Math.abs(axes[1]!.z) + Math.abs(axes[2]!.z),
    };
    let radius = 0;
    for (const xSign of [-1, 1]) {
        for (const ySign of [-1, 1]) {
            for (const zSign of [-1, 1]) {
                radius = Math.max(
                    radius,
                    vectorLength({
                        x: xSign * axes[0]!.x + ySign * axes[1]!.x + zSign * axes[2]!.x,
                        y: xSign * axes[0]!.y + ySign * axes[1]!.y + zSign * axes[2]!.y,
                        z: xSign * axes[0]!.z + ySign * axes[1]!.z + zSign * axes[2]!.z,
                    }),
                );
            }
        }
    }
    return {
        boundingBox: {
            min: { x: center.x - extent.x, y: center.y - extent.y, z: center.z - extent.z },
            max: { x: center.x + extent.x, y: center.y + extent.y, z: center.z + extent.z },
        },
        boundingSphere: { center, radius },
    };
}

export function boundsFromSphere(sphere: Sphere, matrix: Float64Array): EcefBounds {
    const center = transformPoint(matrix, { x: sphere[0], y: sphere[1], z: sphere[2] });
    const radius = sphere[3] * maximumScale(matrix);
    return {
        boundingSphere: { center, radius },
        boundingBox: {
            min: { x: center.x - radius, y: center.y - radius, z: center.z - radius },
            max: { x: center.x + radius, y: center.y + radius, z: center.z + radius },
        },
    };
}

function angleWithin(angle: number, west: number, east: number): boolean {
    const fullTurn = Math.PI * 2;
    const normalized = ((angle % fullTurn) + fullTurn) % fullTurn;
    const normalizedWest = ((west % fullTurn) + fullTurn) % fullTurn;
    let normalizedEast = ((east % fullTurn) + fullTurn) % fullTurn;
    if (normalizedEast < normalizedWest) normalizedEast += fullTurn;
    const candidate = normalized < normalizedWest ? normalized + fullTurn : normalized;
    return candidate >= normalizedWest && candidate <= normalizedEast;
}

function regionSamples(region: Region): Array<readonly [number, number, number]> {
    const [west, south, east, north, minimumHeight, maximumHeight] = region;
    const longitudes = new Set([west, east, (west + (east < west ? east + Math.PI * 2 : east)) / 2]);
    for (const candidate of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
        if (angleWithin(candidate, west, east)) longitudes.add(candidate);
    }
    const latitudes = new Set([south, north, (south + north) / 2]);
    if (south <= 0 && north >= 0) latitudes.add(0);
    const samples: Array<readonly [number, number, number]> = [];
    for (const longitude of longitudes) {
        for (const latitude of latitudes) {
            samples.push([longitude, latitude, minimumHeight], [longitude, latitude, maximumHeight]);
        }
    }
    return samples;
}

export function boundsFromRegion(region: Region, system: GeodeticSystem): EcefBounds {
    return boundsFromPoints(
        regionSamples(region).map(([longitude, latitude, height]) => system.geodeticRadiansToEcef(latitude, longitude, height)),
    );
}

/** Axis-aligned box and enclosing sphere of a set of ECEF sample points. */
export function boundsFromPoints(points: readonly IVector3[]): EcefBounds {
    const min = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY };
    const max = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY };
    for (const point of points) {
        min.x = Math.min(min.x, point.x);
        min.y = Math.min(min.y, point.y);
        min.z = Math.min(min.z, point.z);
        max.x = Math.max(max.x, point.x);
        max.y = Math.max(max.y, point.y);
        max.z = Math.max(max.z, point.z);
    }
    const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
    const radius = points.reduce(
        (current, point) => Math.max(current, Math.hypot(point.x - center.x, point.y - center.y, point.z - center.z)),
        0,
    );
    return { boundingBox: { min, max }, boundingSphere: { center, radius } };
}

export function boxesIntersect(left: IAxisAlignedBox, right: IAxisAlignedBox): boolean {
    return !(
        left.max.x < right.min.x ||
        left.min.x > right.max.x ||
        left.max.y < right.min.y ||
        left.min.y > right.max.y ||
        left.max.z < right.min.z ||
        left.min.z > right.max.z
    );
}

export function sphereOutsidePlane(sphere: IBoundingSphere3, plane: { x: number; y: number; z: number; w: number }): boolean {
    return plane.x * sphere.center.x + plane.y * sphere.center.y + plane.z * sphere.center.z + plane.w < -sphere.radius;
}

/**
 * Whether a tile lies beyond the horizon of a spherical body, from the true formula: a point at distance `p` from the
 * centre is hidden from a camera at distance `c` by a sphere of radius `r` when their angle exceeds
 * `acos(r / c) + acos(r / p)`, the horizons of the camera and of the point. The test takes the highest point of the tile.
 *
 * The sphere must be solid: a sight line may pass over any basin between the camera and the tile, so it lies below the
 * lowest terrain of the body, not only of the tile. A tile without known heights uses the extent of its bounding sphere.
 *
 * @param bodyRadius - Radius of the reference surface of the body, in metres.
 * @param lowestHeight - Lowest terrain of the body over that surface, in metres.
 * @param heightRange - Lowest and highest heights of the tile over that surface, in metres.
 */
export function isSphereBeyondHorizon(
    sphere: IBoundingSphere3,
    cameraPosition: IVector3,
    bodyRadius: number,
    lowestHeight: number,
    heightRange?: readonly [number, number],
): boolean {
    const centreDistance = vectorLength(sphere.center);
    if (sphere.radius >= centreDistance) return false;
    const cameraDistance = vectorLength(cameraPosition);
    const lowest = heightRange ? bodyRadius + heightRange[0] : centreDistance - sphere.radius;
    const highest = heightRange ? bodyRadius + heightRange[1] : centreDistance + sphere.radius;
    const occluder = Math.min(bodyRadius + Math.min(0, lowestHeight), lowest);
    if (occluder <= 0 || cameraDistance <= occluder) return false;
    const cosine =
        (sphere.center.x * cameraPosition.x + sphere.center.y * cameraPosition.y + sphere.center.z * cameraPosition.z) /
        (centreDistance * cameraDistance);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
    const extent = Math.asin(sphere.radius / centreDistance);
    return angle - extent > Math.acos(occluder / cameraDistance) + Math.acos(occluder / Math.max(occluder, highest));
}

export function isSphereBelowConservativeHorizon(sphere: IBoundingSphere3, cameraPosition: IVector3, occluderRadius: number): boolean {
    const cameraDistance = vectorLength(cameraPosition);
    if (cameraDistance <= occluderRadius) return false;
    const centreDotCamera = sphere.center.x * cameraPosition.x + sphere.center.y * cameraPosition.y + sphere.center.z * cameraPosition.z;
    return centreDotCamera + sphere.radius * cameraDistance < occluderRadius * occluderRadius;
}
