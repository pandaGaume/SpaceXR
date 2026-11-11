import type { ICartesian3 } from "@spacexr/geodesy";

import { tileCount, type ITileAddress } from "../addressing/tile-address";
import { cubeTileDirection } from "../cube/cube-mapping";
import type { ReferenceSurface } from "../cube/reference-surface";
import type { IMapPosition, ISourceProjection } from "./source-projection";
import { sourcePixelAt, sourcePixelCoordinates, type ISourceTile, type ISourceTileMatrix } from "./source-tile-matrix";

/** A raster source seen from the cube: its projection and the level it is read at. */
export interface ICubeSourceLevel {
    projection: ISourceProjection;
    matrix: ISourceTileMatrix;
}

/** Period of a map, in pixels of a matrix, when it wraps around the body. */
function periodPixels({ projection, matrix }: ICubeSourceLevel): number | undefined {
    return projection.periodX === undefined ? undefined : projection.periodX / matrix.pixelSize;
}

/**
 * Coarsest level of a source at least as fine as a level of the cube, the last one otherwise. It depends on the level of
 * the cube alone, so both sides of a tile edge read the same level. On a global geographic source, it is `lod + 1`.
 *
 * @param bodyRadius - Radius of the body, in metres.
 * @param lod - Level of the cube.
 * @param tileSize - Cells per side of the tiles of the cube.
 * @param matrices - Levels of the source, from the coarsest.
 * @throws RangeError When the source has no level.
 */
export function cubeSourceMatrix(projection: ISourceProjection, matrices: readonly ISourceTileMatrix[], bodyRadius: number, lod: number, tileSize = 256): ISourceTileMatrix {
    if (matrices.length === 0) throw new RangeError("The source has no level.");
    const spacing = (Math.PI / 2) * (bodyRadius / (tileSize * tileCount(lod)));
    return matrices.find((matrix) => matrix.pixelSize * projection.metresPerUnit <= spacing * (1 + 1e-9)) ?? matrices[matrices.length - 1]!;
}

/** Runs through the `(tileSize + 1)^2` samples of a tile of the cube, in rows from its north-west corner. */
function forEachSample(address: ITileAddress, tileSize: number, visit: (index: number, direction: Readonly<ICartesian3>) => void): void {
    const side = tileSize + 1;
    const direction: ICartesian3 = { x: 0, y: 0, z: 0 };
    for (let row = 0; row < side; row++) {
        for (let column = 0; column < side; column++) {
            cubeTileDirection(address, column / tileSize, row / tileSize, direction);
            visit(row * side + column, direction);
        }
    }
}

/**
 * The tiles of a source that the samples of a tile of the cube read, to load before {@link resampleCubeTile}.
 *
 * @param tileSize - Cells per side of the tile of the cube. Defaults to 256.
 */
export function cubeTileSourceTiles(address: ITileAddress, source: ICubeSourceLevel, tileSize = 256): ISourceTile[] {
    const found = new Map<string, ISourceTile>();
    const period = periodPixels(source);
    const position: IMapPosition = { x: 0, y: 0 };
    const pixel: IMapPosition = { x: 0, y: 0 };
    forEachSample(address, tileSize, (_index, direction) => {
        sourcePixelCoordinates(source.matrix, source.projection.forward(direction, position), pixel);
        const left = Math.floor(pixel.x);
        const top = Math.floor(pixel.y);
        for (const [dx, dy] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
        ] as const) {
            const at = sourcePixelAt(source.matrix, left + dx, top + dy, period);
            if (at) found.set(`${at.column}/${at.row}`, { column: at.column, row: at.row });
        }
    });
    return [...found.values()];
}

/**
 * Value of a source at a pixel of a loaded tile, `NaN` where it has none: a missing tile, or its no-data value.
 *
 * @param column - Column of the tile.
 * @param row - Row of the tile.
 * @param x - Pixel in the tile.
 * @param y - Pixel in the tile.
 * @param channel - Channel of the pixel.
 */
export type SourcePixelReader = (column: number, row: number, x: number, y: number, channel: number) => number;

export interface IResampleCubeTileOptions {
    /** Cells per side of the tile of the cube. Defaults to 256: 257 samples per side. */
    tileSize?: number;
    /** Channels per sample. Defaults to 1. */
    channels?: number;
    /** Receives the samples, channels interleaved. Defaults to a new array. */
    target?: Float32Array;
}

/**
 * Reads a source at the samples of a tile of the cube, bilinearly in its pixels: `(tileSize + 1)^2` samples in point
 * registration. A sample depends on its direction alone, so tiles sharing an edge hold the same samples on it, across cube
 * faces included. Pixels without data are left out of the interpolation; a sample with none is `NaN`.
 *
 * @throws RangeError When a supplied target has another length.
 */
export function resampleCubeTile(address: ITileAddress, source: ICubeSourceLevel, read: SourcePixelReader, options: IResampleCubeTileOptions = {}): Float32Array {
    const tileSize = options.tileSize ?? 256;
    const channels = options.channels ?? 1;
    const length = (tileSize + 1) ** 2 * channels;
    const data = options.target ?? new Float32Array(length);
    if (data.length !== length) throw new RangeError(`A tile of ${tileSize} cells needs ${length} values, not ${data.length}.`);
    const period = periodPixels(source);
    const position: IMapPosition = { x: 0, y: 0 };
    const pixel: IMapPosition = { x: 0, y: 0 };
    forEachSample(address, tileSize, (index, direction) => {
        sourcePixelCoordinates(source.matrix, source.projection.forward(direction, position), pixel);
        const left = Math.floor(pixel.x);
        const top = Math.floor(pixel.y);
        const fx = pixel.x - left;
        const fy = pixel.y - top;
        for (let channel = 0; channel < channels; channel++) {
            let sum = 0;
            let weights = 0;
            for (const [dx, dy, weight] of [
                [0, 0, (1 - fx) * (1 - fy)],
                [1, 0, fx * (1 - fy)],
                [0, 1, (1 - fx) * fy],
                [1, 1, fx * fy],
            ] as const) {
                if (weight === 0) continue;
                const at = sourcePixelAt(source.matrix, left + dx, top + dy, period);
                const value = at ? read(at.column, at.row, at.x, at.y, channel) : Number.NaN;
                if (Number.isNaN(value)) continue;
                sum += value * weight;
                weights += weight;
            }
            data[index * channels + channel] = weights > 0 ? sum / weights : Number.NaN;
        }
    });
    return data;
}

/**
 * Radial height over a reference surface of a source whose heights are radial over a sphere, such as LOLA over 1737.4 km:
 * `h + sourceRadius - radius(direction)`. It is the height itself when both surfaces are that sphere.
 */
export function rebaseRadialHeight(height: number, sourceRadius: number, reference: ReferenceSurface, direction: Readonly<ICartesian3>): number {
    return height + sourceRadius - reference.radius(direction);
}

/**
 * Weight of a polar source against a global one, from a unit direction: 0 up to `fromDegrees` of latitude, 1 from
 * `toDegrees`, smooth in between. It depends on the direction alone, so shared edges stay identical. Latitudes are
 * planetocentric and absolute.
 *
 * @throws RangeError When `toDegrees` does not exceed `fromDegrees`.
 */
export function capBlendWeight(direction: Readonly<ICartesian3>, fromDegrees: number, toDegrees: number): number {
    if (!(toDegrees > fromDegrees)) throw new RangeError("A cap blend must end beyond its start.");
    const latitude = (Math.atan2(Math.abs(direction.z), Math.hypot(direction.x, direction.y)) * 180) / Math.PI;
    const t = Math.min(Math.max((latitude - fromDegrees) / (toDegrees - fromDegrees), 0), 1);
    return t * t * (3 - 2 * t);
}
