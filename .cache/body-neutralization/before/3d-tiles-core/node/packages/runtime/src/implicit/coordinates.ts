import {
    createUtmBoundingVolume,
    getUtmBoundingVolume,
    type IBoundingVolume,
    type IContent,
    type IImplicitTiling,
    type ITile,
    type IUtmBoundingVolume,
} from "@spacexr/3d-tiles-core";

import type { IImplicitCoordinates } from "./types";

function coordinateScale(level: number): number {
    const scale = 2 ** level;
    if (!Number.isSafeInteger(scale)) throw new RangeError(`Implicit level ${level} exceeds the safe coordinate range.`);
    return scale;
}

function normalizeLongitude(value: number): number {
    if (value === Math.PI) return value;
    const tau = Math.PI * 2;
    return ((((value + Math.PI) % tau) + tau) % tau) - Math.PI;
}

export function implicitBranchingFactor(tiling: IImplicitTiling): 4 | 8 {
    return tiling.subdivisionScheme === "OCTREE" ? 8 : 4;
}

export function implicitMortonIndex(coordinates: IImplicitCoordinates, scheme: IImplicitTiling["subdivisionScheme"]): number {
    const dimensions = scheme === "OCTREE" ? 3 : 2;
    let result = 0;
    for (let bit = 0; bit < coordinates.level; bit++) {
        const divisor = 2 ** bit;
        const x = Math.floor(coordinates.x / divisor) % 2;
        const y = Math.floor(coordinates.y / divisor) % 2;
        const z = scheme === "OCTREE" ? Math.floor((coordinates.z ?? 0) / divisor) % 2 : 0;
        result += x * 2 ** (dimensions * bit) + y * 2 ** (dimensions * bit + 1);
        if (dimensions === 3) result += z * 2 ** (dimensions * bit + 2);
    }
    if (!Number.isSafeInteger(result)) throw new RangeError("The Morton index exceeds the JavaScript safe integer range.");
    return result;
}

export function implicitLevelOffset(level: number, branchingFactor: 4 | 8): number {
    const result = (branchingFactor ** level - 1) / (branchingFactor - 1);
    if (!Number.isSafeInteger(result)) throw new RangeError("The availability level offset exceeds the JavaScript safe integer range.");
    return result;
}

export function implicitAvailabilityIndex(coordinates: IImplicitCoordinates, tiling: IImplicitTiling): number {
    return (
        implicitLevelOffset(coordinates.level, implicitBranchingFactor(tiling)) + implicitMortonIndex(coordinates, tiling.subdivisionScheme)
    );
}

export function expandImplicitTemplate(template: string, coordinates: IImplicitCoordinates): string {
    return template
        .replaceAll("{level}", String(coordinates.level))
        .replaceAll("{x}", String(coordinates.x))
        .replaceAll("{y}", String(coordinates.y))
        .replaceAll("{z}", String(coordinates.z ?? 0));
}

export function implicitChildCoordinates(
    parent: IImplicitCoordinates,
    childIndex: number,
    scheme: IImplicitTiling["subdivisionScheme"],
): IImplicitCoordinates {
    const result: IImplicitCoordinates = {
        level: parent.level + 1,
        x: parent.x * 2 + (childIndex & 1),
        y: parent.y * 2 + ((childIndex >> 1) & 1),
    };
    if (scheme === "OCTREE") result.z = (parent.z ?? 0) * 2 + ((childIndex >> 2) & 1);
    return result;
}

export function implicitLocalCoordinates(global: IImplicitCoordinates, subtreeRoot: IImplicitCoordinates): IImplicitCoordinates {
    const level = global.level - subtreeRoot.level;
    const scale = coordinateScale(level);
    const result: IImplicitCoordinates = {
        level,
        x: global.x - subtreeRoot.x * scale,
        y: global.y - subtreeRoot.y * scale,
    };
    if (global.z !== undefined || subtreeRoot.z !== undefined) result.z = (global.z ?? 0) - (subtreeRoot.z ?? 0) * scale;
    return result;
}

function subdivideUtmExtent(
    root: IUtmBoundingVolume,
    scheme: IImplicitTiling["subdivisionScheme"],
    coordinates: IImplicitCoordinates,
    scale: number,
): IUtmBoundingVolume {
    const eastingSize = (root.maxEasting - root.minEasting) / scale;
    const northingSize = (root.maxNorthing - root.minNorthing) / scale;
    const minEasting = root.minEasting + eastingSize * coordinates.x;
    const minNorthing = root.minNorthing + northingSize * coordinates.y;
    let vertical = root.vertical;
    if (scheme === "OCTREE") {
        // The z coordinate grows upward, so depths measured downward are split from their maximum.
        const verticalSize = (root.vertical.maximum - root.vertical.minimum) / scale;
        const offset = verticalSize * (coordinates.z ?? 0);
        vertical =
            root.vertical.direction === "DOWN"
                ? { ...root.vertical, minimum: root.vertical.maximum - offset - verticalSize, maximum: root.vertical.maximum - offset }
                : { ...root.vertical, minimum: root.vertical.minimum + offset, maximum: root.vertical.minimum + offset + verticalSize };
    }
    return { ...root, minEasting, minNorthing, maxEasting: minEasting + eastingSize, maxNorthing: minNorthing + northingSize, vertical };
}

export function subdivideImplicitBoundingVolume(
    root: IBoundingVolume,
    scheme: IImplicitTiling["subdivisionScheme"],
    coordinates: IImplicitCoordinates,
): IBoundingVolume {
    const scale = coordinateScale(coordinates.level);
    const utm = getUtmBoundingVolume(root);
    if (utm) return createUtmBoundingVolume(subdivideUtmExtent(utm, scheme, coordinates, scale));
    if (root.region) {
        const [west, south, east, north, minimumHeight, maximumHeight] = root.region;
        const unwrappedEast = east < west ? east + Math.PI * 2 : east;
        const longitudeSize = (unwrappedEast - west) / scale;
        const latitudeSize = (north - south) / scale;
        const childWest = west + longitudeSize * coordinates.x;
        const childEast = childWest + longitudeSize;
        let childMinimumHeight = minimumHeight;
        let childMaximumHeight = maximumHeight;
        if (scheme === "OCTREE") {
            const heightSize = (maximumHeight - minimumHeight) / scale;
            childMinimumHeight = minimumHeight + heightSize * (coordinates.z ?? 0);
            childMaximumHeight = childMinimumHeight + heightSize;
        }
        return {
            region: [
                normalizeLongitude(childWest),
                south + latitudeSize * coordinates.y,
                normalizeLongitude(childEast),
                south + latitudeSize * (coordinates.y + 1),
                childMinimumHeight,
                childMaximumHeight,
            ],
        };
    }
    if (root.box) {
        const [cx, cy, cz, ...axes] = root.box;
        const xAxis = axes.slice(0, 3);
        const yAxis = axes.slice(3, 6);
        const zAxis = axes.slice(6, 9);
        const xCoefficient = -1 + (2 * coordinates.x + 1) / scale;
        const yCoefficient = -1 + (2 * coordinates.y + 1) / scale;
        const zCoefficient = scheme === "OCTREE" ? -1 + (2 * (coordinates.z ?? 0) + 1) / scale : 0;
        const center = [
            cx + xAxis[0]! * xCoefficient + yAxis[0]! * yCoefficient + zAxis[0]! * zCoefficient,
            cy + xAxis[1]! * xCoefficient + yAxis[1]! * yCoefficient + zAxis[1]! * zCoefficient,
            cz + xAxis[2]! * xCoefficient + yAxis[2]! * yCoefficient + zAxis[2]! * zCoefficient,
        ];
        const zScale = scheme === "OCTREE" ? scale : 1;
        return {
            box: [
                center[0]!,
                center[1]!,
                center[2]!,
                xAxis[0]! / scale,
                xAxis[1]! / scale,
                xAxis[2]! / scale,
                yAxis[0]! / scale,
                yAxis[1]! / scale,
                yAxis[2]! / scale,
                zAxis[0]! / zScale,
                zAxis[1]! / zScale,
                zAxis[2]! / zScale,
            ],
        };
    }
    throw new Error("Implicit tiling requires a box, region or SPACEXR_bounding_volume_utm bounding volume.");
}

export function computeImplicitTile(
    rootTile: ITile,
    tiling: IImplicitTiling,
    coordinates: IImplicitCoordinates,
): Pick<ITile, "boundingVolume" | "geometricError"> & {
    contents: readonly IContent[];
} {
    const templates = rootTile.contents ? [...rootTile.contents] : rootTile.content ? [rootTile.content] : [];
    return {
        boundingVolume: subdivideImplicitBoundingVolume(rootTile.boundingVolume, tiling.subdivisionScheme, coordinates),
        geometricError: rootTile.geometricError / coordinateScale(coordinates.level),
        contents: templates.map((content) => ({ ...content, uri: expandImplicitTemplate(content.uri, coordinates) })),
    };
}
