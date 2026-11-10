import {
    TileNeighbor,
    assertRasterRegistration,
    tileAddressKey as key,
    tileNeighborAddress,
    type ITileAddress,
    type ITileNeighborOptions,
    type RasterRegistration,
} from "@spacexr/tiles";

import { allocateLike, createRasterGrid, type IRasterGrid } from "./raster-grid";

/** Builds the grid type of a stitched raster, for example a height grid with its range, from stitched values. */
export type RasterGridFactory<TGrid extends IRasterGrid> = (width: number, height: number, channels: number, data: TGrid["data"]) => TGrid;

export interface IStitchedRasterGridsOptions<TGrid extends IRasterGrid> extends ITileNeighborOptions {
    /** Builds each stitched grid. Defaults to a plain {@link IRasterGrid}. */
    create?: RasterGridFactory<TGrid>;
    /**
     * Where the samples of the tiles lie, declared by their source. Required, with no default.
     *
     * - `area`: `w x h` pixels centred half a pixel from the edges. Each stitched sample lies on a corner of the pixels and
     *   is the mean of the four pixels around it, read from the eight neighbours near the edges.
     * - `point`: tiles already hold their shared edges, `(w + 1) x (h + 1)` samples, as a tile service of the cube index
     *   produces them. Nothing is taken from the neighbours.
     */
    registration: RasterRegistration;
    /**
     * @deprecated Declare `registration` alone: `true` is `point`, `false` is `area`. This option no longer decides
     *     anything and does not replace `registration`: a value that disagrees with it is rejected.
     */
    prestitched?: boolean;
}

/** Rejects a missing or unknown registration, and a deprecated `prestitched` that disagrees with it. */
function assertDeclaredRegistration(registration: RasterRegistration, prestitched: boolean | undefined): void {
    if (prestitched !== undefined) {
        const meant = prestitched ? "point" : "area";
        if (registration !== meant) {
            throw new TypeError(
                `prestitched is deprecated and does not replace registration: prestitched: ${String(prestitched)} is registration: "${meant}", declared ${String(registration)}.`
            );
        }
    }
    assertRasterRegistration(registration);
}

interface IStitchedEntry<TGrid extends IRasterGrid> {
    readonly address: ITileAddress;
    /** `(width + 1) x (height + 1)` samples, row-major from the north-west corner. */
    readonly data: TGrid["data"];
    /** Pixels of a tile in `area` registration, `width x height`. */
    readonly pixels?: TGrid["data"];
    readonly width: number;
    readonly height: number;
    readonly channels: number;
    grid: TGrid;
}

/**
 * Rasters of neighbouring tiles stitched together, as SpaceXR does for its elevation textures.
 *
 * A tile of `w x h` pixels does not reach its edges: its pixels lie half a pixel inside the tile, so two neighbouring
 * tiles never share a sample, and heights and colours alike show a seam once interpolated. Each tile therefore becomes
 * `(w + 1) x (h + 1)` samples in `point` registration, on the corners of its pixels: each one is the mean of the four
 * pixels around it, so the surface stays where the source placed it, smoothed by half a pixel.
 *
 * Near an edge, the pixels come from the eight neighbours. Until a neighbour is added its pixels are left out. Adding a
 * tile also updates the corners it touches in the tiles already present, so that the arrival order does not matter.
 * Shared edges then hold the same samples on both sides, and grids sampled with `point` registration meet without seams.
 *
 * Generated tiles already hold samples of the corner lattice, `x + i / w` in tile units, `w x h` per tile: they only
 * receive the first column of their east neighbour, the first row of their south neighbour and the first sample of their
 * south-east neighbour.
 */
export class StitchedRasterGrids<TGrid extends IRasterGrid = IRasterGrid> {
    private readonly entries = new Map<string, IStitchedEntry<TGrid>>();
    private readonly create: RasterGridFactory<TGrid>;

    /**
     * @param options - Registration of the tiles, neighbour lookup, where `wrapX` stitches the antimeridian of a global pyramid, and grid factory.
     * @throws TypeError When the registration is missing or unknown, or when the deprecated `prestitched` disagrees with it.
     */
    public constructor(private readonly options: IStitchedRasterGridsOptions<TGrid>) {
        assertDeclaredRegistration(options.registration, options.prestitched);
        this.create = options.create ?? ((width, height, channels, data) => createRasterGrid(width, height, channels, data) as TGrid);
    }

    public get size(): number {
        return this.entries.size;
    }

    public has(address: ITileAddress): boolean {
        return this.entries.has(key(address));
    }

    /** The stitched grid of a tile, to sample with `point` registration, or `undefined` when the tile is absent. */
    public get(address: ITileAddress): TGrid | undefined {
        return this.entries.get(key(address))?.grid;
    }

    /**
     * Adds or replaces the raster of a tile.
     *
     * @param samples - `generated` for a tile generated below the source. In `area` registration it holds samples of the
     *     corner lattice; in `point` registration it holds its shared edges, like a tile of the source.
     * @returns The tiles whose stitched grid changed: the tile itself and the neighbours it completed.
     * @throws RangeError When a neighbour already present has a different size or number of channels.
     */
    public add(address: ITileAddress, grid: IRasterGrid<TGrid["data"]>, samples: "source" | "generated" = "source"): ITileAddress[] {
        if (this.options.registration === "area" && samples === "source") return this.addPixels(address, grid);
        if (this.options.registration === "point") {
            if (grid.width < 2 || grid.height < 2) throw new RangeError("A raster in point registration holds at least 2 x 2 samples.");
            const stitched = this.create(grid.width, grid.height, grid.channels, grid.data);
            const own: IStitchedEntry<TGrid> = {
                address: { ...address },
                data: grid.data,
                width: grid.width - 1,
                height: grid.height - 1,
                channels: grid.channels,
                grid: stitched,
            };
            this.entries.set(key(address), own);
            return [own.address];
        }
        const { width, height, channels } = grid;
        const rowLength = width * channels;
        const stitchedRowLength = (width + 1) * channels;
        const data = allocateLike(grid.data, stitchedRowLength * (height + 1));
        for (let row = 0; row < height; row++) {
            data.set(grid.data.subarray(row * rowLength, (row + 1) * rowLength), row * stitchedRowLength);
            data.set(grid.data.subarray((row + 1) * rowLength - channels, (row + 1) * rowLength), row * stitchedRowLength + rowLength);
        }
        data.copyWithin(height * stitchedRowLength, (height - 1) * stitchedRowLength, height * stitchedRowLength);
        const entry: IStitchedEntry<TGrid> = { address: { ...address }, data, width, height, channels, grid: undefined as unknown as TGrid };
        this.entries.set(key(address), entry);

        const neighbor = (position: TileNeighbor): IStitchedEntry<TGrid> | undefined => {
            const neighborAddress = tileNeighborAddress(address, position, this.options);
            const found = neighborAddress ? this.entries.get(key(neighborAddress)) : undefined;
            if (found && found !== entry && (found.width !== width || found.height !== height || found.channels !== channels)) {
                throw new RangeError(`Tile ${key(found.address)} has ${found.width} x ${found.height} x ${found.channels} values, expected ${width} x ${height} x ${channels}.`);
            }
            return found === entry ? undefined : found;
        };

        // Pull the edges of the neighbours already present on the east, south and south-east.
        const east = neighbor(TileNeighbor.E);
        if (east) copyFirstColumn(east, entry);
        const south = neighbor(TileNeighbor.S);
        if (south) copyFirstRow(south, entry);
        const southEast = neighbor(TileNeighbor.SE);
        if (southEast) copyFirstSample(southEast, entry);
        entry.grid = this.create(width + 1, height + 1, channels, data);

        // Push the edges of the tile into the neighbours already present on the west, north and north-west.
        const changed: ITileAddress[] = [entry.address];
        const west = neighbor(TileNeighbor.W);
        if (west) copyFirstColumn(entry, west);
        const north = neighbor(TileNeighbor.N);
        if (north) copyFirstRow(entry, north);
        const northWest = neighbor(TileNeighbor.NW);
        if (northWest) copyFirstSample(entry, northWest);
        for (const completed of [west, north, northWest]) {
            if (!completed || changed.some((address) => key(address) === key(completed.address))) continue;
            completed.grid = this.create(completed.width + 1, completed.height + 1, completed.channels, completed.data);
            changed.push(completed.address);
        }
        return changed;
    }

    /** Stitches a tile of pixels, and updates the corners it touches in the tiles already present. */
    private addPixels(address: ITileAddress, grid: IRasterGrid<TGrid["data"]>): ITileAddress[] {
        const { width, height, channels } = grid;
        const data = allocateLike(grid.data, (width + 1) * (height + 1) * channels);
        const entry: IStitchedEntry<TGrid> = { address: { ...address }, data, pixels: grid.data, width, height, channels, grid: undefined as unknown as TGrid };
        this.entries.set(key(address), entry);
        fillInnerCorners(entry);
        writeCorners(entry, this.tilesAround(entry), 0, width, 0, height, true);
        entry.grid = this.create(width + 1, height + 1, channels, data);

        const completed = new Map<string, IStitchedEntry<TGrid>>();
        this.tilesAround(entry).forEach((neighbor, position) => {
            if (!neighbor || neighbor === entry) return;
            const [columnFrom, columnTo, rowFrom, rowTo] = cornersTouching(position, width, height);
            writeCorners(neighbor, this.tilesAround(neighbor), columnFrom, columnTo, rowFrom, rowTo, false);
            completed.set(key(neighbor.address), neighbor);
        });
        for (const neighbor of completed.values()) neighbor.grid = this.create(width + 1, height + 1, channels, neighbor.data);
        return [entry.address, ...[...completed.values()].map((neighbor) => neighbor.address)];
    }

    /** The tile and its neighbours, indexed by {@link TileNeighbor}. A tile wrapping around a level of one column is its own neighbour. */
    private tilesAround(entry: IStitchedEntry<TGrid>): readonly (IStitchedEntry<TGrid> | undefined)[] {
        const { address, width, height, channels } = entry;
        return AROUND.map((position) => {
            if (position === TileNeighbor.C) return entry;
            const neighborAddress = tileNeighborAddress(address, position, this.options);
            const found = neighborAddress ? this.entries.get(key(neighborAddress)) : undefined;
            if (found && (found.width !== width || found.height !== height || found.channels !== channels)) {
                throw new RangeError(`Tile ${key(found.address)} has ${found.width} x ${found.height} x ${found.channels} values, expected ${width} x ${height} x ${channels}.`);
            }
            return found;
        });
    }

    /** Forgets a tile. The neighbours keep the edges it gave them. */
    public delete(address: ITileAddress): boolean {
        return this.entries.delete(key(address));
    }
}

const AROUND: readonly TileNeighbor[] = [
    TileNeighbor.NW,
    TileNeighbor.N,
    TileNeighbor.NE,
    TileNeighbor.W,
    TileNeighbor.C,
    TileNeighbor.E,
    TileNeighbor.SW,
    TileNeighbor.S,
    TileNeighbor.SE,
];

/** Columns and rows, `[columnFrom, columnTo, rowFrom, rowTo]`, of the corners of a tile touching a tile added at `position` of it. */
function cornersTouching(position: number, width: number, height: number): readonly [number, number, number, number] {
    const column = position % 3;
    const row = Math.floor(position / 3);
    return [
        column === 1 ? 0 : column === 2 ? 0 : width,
        column === 1 ? width : column === 2 ? 0 : width,
        row === 1 ? 0 : row === 2 ? 0 : height,
        row === 1 ? height : row === 2 ? 0 : height,
    ];
}

function isFloat(data: IRasterGrid["data"]): boolean {
    return data instanceof Float32Array || data instanceof Float64Array;
}

/** Corners away from the edges: each reads four pixels of the tile itself. */
function fillInnerCorners<TGrid extends IRasterGrid>(entry: IStitchedEntry<TGrid>): void {
    const { width, height, channels, data } = entry;
    const pixels = entry.pixels!;
    const stride = width * channels;
    if (!isFloat(data)) {
        for (let row = 1; row < height; row++) {
            let source = (row * width + 1) * channels;
            let target = (row * (width + 1) + 1) * channels;
            const end = (row + 1) * stride;
            for (; source < end; source++, target++) {
                data[target] = Math.round((pixels[source - stride - channels]! + pixels[source - stride]! + pixels[source - channels]! + pixels[source]!) / 4);
            }
        }
        return;
    }
    for (let row = 1; row < height; row++) {
        let source = (row * width + 1) * channels;
        let target = (row * (width + 1) + 1) * channels;
        const end = (row + 1) * stride;
        for (; source < end; source++, target++) {
            const a = pixels[source - stride - channels]!;
            const b = pixels[source - stride]!;
            const c = pixels[source - channels]!;
            const d = pixels[source]!;
            const mean = (a + b + c + d) / 4;
            if (!Number.isNaN(mean)) data[target] = mean;
            else {
                let sum = 0;
                let count = 0;
                if (!Number.isNaN(a)) {
                    sum += a;
                    count++;
                }
                if (!Number.isNaN(b)) {
                    sum += b;
                    count++;
                }
                if (!Number.isNaN(c)) {
                    sum += c;
                    count++;
                }
                if (!Number.isNaN(d)) {
                    sum += d;
                    count++;
                }
                data[target] = count === 0 ? Number.NaN : sum / count;
            }
        }
    }
}

/**
 * Writes corners of a tile from the four pixels around each one, leaving out those of a tile not present and missing
 * values. Corners away from the edges are skipped when `edgesOnly`.
 */
function writeCorners<TGrid extends IRasterGrid>(
    entry: IStitchedEntry<TGrid>,
    around: readonly (IStitchedEntry<TGrid> | undefined)[],
    columnFrom: number,
    columnTo: number,
    rowFrom: number,
    rowTo: number,
    edgesOnly: boolean
): void {
    const { width, height, channels, data } = entry;
    const float = isFloat(data);
    const stitchedStride = (width + 1) * channels;
    for (let row = rowFrom; row <= rowTo; row++) {
        for (let column = columnFrom; column <= columnTo; column++) {
            if (edgesOnly && column > 0 && column < width && row > 0 && row < height) continue;
            for (let channel = 0; channel < channels; channel++) {
                let sum = 0;
                let count = 0;
                for (let y = row - 1; y <= row; y++) {
                    for (let x = column - 1; x <= column; x++) {
                        const tileColumn = x < 0 ? 0 : x >= width ? 2 : 1;
                        const tileRow = y < 0 ? 0 : y >= height ? 2 : 1;
                        const pixels = around[tileRow * 3 + tileColumn]?.pixels;
                        if (!pixels) continue;
                        const value = pixels[((y - (tileRow - 1) * height) * width + x - (tileColumn - 1) * width) * channels + channel]!;
                        if (Number.isNaN(value)) continue;
                        sum += value;
                        count++;
                    }
                }
                const mean = count === 0 ? Number.NaN : sum / count;
                data[row * stitchedStride + column * channels + channel] = float ? mean : Math.round(mean);
            }
        }
    }
}

/** Copies the first column of `source` into the extra column of `target`, the tile on its west. */
function copyFirstColumn<TGrid extends IRasterGrid>(source: IStitchedEntry<TGrid>, target: IStitchedEntry<TGrid>): void {
    const { channels } = target;
    const sourceRowLength = (source.width + 1) * channels;
    const targetRowLength = (target.width + 1) * channels;
    for (let row = 0; row < target.height; row++) {
        target.data.set(source.data.subarray(row * sourceRowLength, row * sourceRowLength + channels), row * targetRowLength + target.width * channels);
    }
}

/** Copies the first row of `source` into the extra row of `target`, the tile on its north. */
function copyFirstRow<TGrid extends IRasterGrid>(source: IStitchedEntry<TGrid>, target: IStitchedEntry<TGrid>): void {
    target.data.set(source.data.subarray(0, source.width * source.channels), target.height * (target.width + 1) * target.channels);
}

/** Copies the first sample of `source` into the extra corner of `target`, the tile on its north-west. */
function copyFirstSample<TGrid extends IRasterGrid>(source: IStitchedEntry<TGrid>, target: IStitchedEntry<TGrid>): void {
    target.data.set(source.data.subarray(0, source.channels), target.data.length - target.channels);
}
