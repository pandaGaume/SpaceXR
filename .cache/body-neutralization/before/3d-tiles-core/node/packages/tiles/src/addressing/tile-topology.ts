import { tileCount, type ITileAddress } from "./tile-address";
import { TileNeighbor, tileNeighborAddress } from "./tile-neighbors";

/** Neighbour of a tile, with the quarter turns from the frame of the tile to the frame of the neighbour. */
export interface ITileTopologyNeighbor {
    readonly address: ITileAddress;
    /** 0 when both tiles share a frame; on the cube index, 1 to 3 across some face edges. */
    readonly turns: number;
}

/**
 * Area of a tile in another tile, in coordinates of the other tile. A point `(u, v)` of the tile lies at
 * `(west + a * size, north + b * size)`, with `(a, b) = turnedTileCoordinates(u, v, turns)`. The area may lie outside
 * the other tile: only the points the two tiles share are inside it.
 */
export interface ITileAreaAcross {
    readonly west: number;
    readonly north: number;
    readonly size: number;
    /** Quarter turns from the frame of the tile to the frame of the other tile. */
    readonly turns: number;
}

/** How the tiles of a pyramid connect: the part of a tiling scheme that neighbours and junctions need. */
export interface ITileTopology {
    /**
     * Neighbour at the same level, or `undefined` beyond the pyramid or at a corner where only 3 tiles meet.
     *
     * @throws RangeError When the address is invalid.
     */
    neighbor(address: ITileAddress, position: TileNeighbor): ITileTopologyNeighbor | undefined;

    /**
     * Area of a tile in another tile that contains or touches it, for reading the data of a neighbour along a shared
     * edge or corner.
     *
     * @throws RangeError When the two tiles cannot touch.
     */
    areaIn(address: ITileAddress, other: ITileAddress): ITileAreaAcross;
}

/**
 * Coordinates of a point of a tile in a frame turned by quarter turns about the centre of the tile. One turn sends the
 * direction `N` to `E`, so `u`, which grows toward `E`, grows toward `S` in the turned frame.
 */
export function turnedTileCoordinates(u: number, v: number, turns: number): [number, number] {
    switch (((turns % 4) + 4) % 4) {
        case 1:
            return [1 - v, u];
        case 2:
            return [1 - u, 1 - v];
        case 3:
            return [v, 1 - u];
        default:
            return [u, v];
    }
}

/** Options of {@link flatTileTopology}. */
export interface IFlatTileTopologyOptions {
    /** Wraps columns around the antimeridian, for pyramids covering every longitude. Defaults to false. */
    wrapX?: boolean;
}

/** Topology of a pyramid with one root, such as Web Mercator: neighbours never turn. */
export function flatTileTopology(options: IFlatTileTopologyOptions = {}): ITileTopology {
    const wrapX = options.wrapX ?? false;
    return {
        neighbor: (address, position) => {
            const neighbor = tileNeighborAddress(address, position, { wrapX });
            return neighbor && { address: neighbor, turns: 0 };
        },
        areaIn: (address, other) => {
            const scale = 2 ** (address.lod - other.lod);
            const size = 1 / scale;
            let west = address.x / scale - other.x;
            if (wrapX) {
                // Take the side of the antimeridian on which the tiles touch.
                const count = tileCount(other.lod);
                if (west > 1) west -= count;
                else if (west + size < 0) west += count;
            }
            return { west, north: address.y / scale - other.y, size, turns: 0 };
        },
    };
}
