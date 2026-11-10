import { assertRasterRegistration, type RasterRegistration } from "../addressing";

import type { IMapPosition } from "./source-projection";

/**
 * One level of the tiles of a raster source. The pixel size is explicit: it cannot always be read from a WMTS
 * `ScaleDenominator`, and the matrix may be larger than the map: a Moon Trek polar matrix of 2 x 1 tiles has its whole map
 * in the first column.
 */
export interface ISourceTileMatrix {
    identifier: string;
    /** Where the pixels lie, required: a WMTS or XYZ tile is `area`; a GeoTIFF declares it in its `GTRasterTypeGeoKey`. */
    registration: RasterRegistration;
    /** Map position of the outer corner of the first pixel in `area` registration, of its centre in `point` registration. */
    originX: number;
    originY: number;
    /** Map units per pixel. Rows run toward decreasing `y`. */
    pixelSize: number;
    tileWidth: number;
    tileHeight: number;
    matrixWidth: number;
    matrixHeight: number;
}

/** A pixel of a source tile. */
export interface ISourcePixel {
    column: number;
    row: number;
    /** Pixel in the tile, 0 at its west and north. */
    x: number;
    y: number;
}

/** Tile of a source. */
export interface ISourceTile {
    column: number;
    row: number;
}

/**
 * Fractional pixel of a map position, over the whole matrix: pixel `n` has its centre at `n`.
 *
 * @throws TypeError When the matrix does not declare its registration.
 */
export function sourcePixelCoordinates(matrix: ISourceTileMatrix, position: Readonly<IMapPosition>, target: IMapPosition = { x: 0, y: 0 }): IMapPosition {
    assertRasterRegistration(matrix.registration);
    const offset = matrix.registration === "area" ? 0.5 : 0;
    target.x = (position.x - matrix.originX) / matrix.pixelSize - offset;
    target.y = (matrix.originY - position.y) / matrix.pixelSize - offset;
    return target;
}

/**
 * The tile and the pixel holding a pixel of the matrix.
 *
 * @param periodPixels - Width of the map in pixels when it wraps around the body; columns then wrap.
 * @returns `undefined` beyond the matrix.
 */
export function sourcePixelAt(matrix: ISourceTileMatrix, pixelX: number, pixelY: number, periodPixels?: number): ISourcePixel | undefined {
    let x = pixelX;
    if (periodPixels !== undefined) x = ((x % periodPixels) + periodPixels) % periodPixels;
    if (x < 0 || pixelY < 0) return undefined;
    const column = Math.floor(x / matrix.tileWidth);
    const row = Math.floor(pixelY / matrix.tileHeight);
    if (column >= matrix.matrixWidth || row >= matrix.matrixHeight) return undefined;
    return { column, row, x: x - column * matrix.tileWidth, y: pixelY - row * matrix.tileHeight };
}

/** The tile matrix of a level of an XYZ Web Mercator pyramid, EPSG:3857: rows from the north, 2^level tiles per side. */
export function webMercatorTileMatrix(level: number, tileSize = 256, semiMajorAxis = 6378137): ISourceTileMatrix {
    const half = Math.PI * semiMajorAxis;
    const tiles = 2 ** level;
    return {
        identifier: String(level),
        registration: "area",
        originX: -half,
        originY: half,
        pixelSize: (2 * half) / (tiles * tileSize),
        tileWidth: tileSize,
        tileHeight: tileSize,
        matrixWidth: tiles,
        matrixHeight: tiles,
    };
}

/** The tile matrix of a level of a global geographic pyramid, such as Moon Trek: 2 x 1 tiles at level 0, from -180 and 90. */
export function geographicTileMatrix(level: number, tileSize = 256): ISourceTileMatrix {
    const tiles = 2 ** level;
    return {
        identifier: String(level),
        registration: "area",
        originX: -180,
        originY: 90,
        pixelSize: 180 / (tiles * tileSize),
        tileWidth: tileSize,
        tileHeight: tileSize,
        matrixWidth: 2 * tiles,
        matrixHeight: tiles,
    };
}
