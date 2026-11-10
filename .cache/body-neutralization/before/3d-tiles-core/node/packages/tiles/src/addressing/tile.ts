import type { ITileMetrics } from "./metrics";
import { assertValidTileAddress, tileAddressToQuadkey, type ITileAddress } from "./tile-address";

/** Geographic extent in degrees. `west` may be greater than `east` only for extents crossing the antimeridian. */
export interface IGeoBounds {
    west: number;
    south: number;
    east: number;
    north: number;
}

/** Extent in map pixels at the tile level of detail, from the north-west corner of the map. */
export interface IPixelBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Tile of a pyramid with its location and optional content. */
export interface ITile<T> {
    readonly address: ITileAddress;
    readonly quadkey: string;
    /** Identifies the pyramid, for example a source id. Empty by default. */
    readonly namespace: string;
    /** Unique key across pyramids: `namespace:quadkey`. */
    readonly key: string;
    readonly geoBounds: IGeoBounds;
    readonly pixelBounds: IPixelBounds;
    content: T | undefined;
}

/** Returns the geographic extent of a tile. */
export function tileGeoBounds(address: ITileAddress, metrics: ITileMetrics): IGeoBounds {
    const northWest = metrics.getTileXYToLatLon(address.x, address.y, address.lod);
    const southEast = metrics.getTileXYToLatLon(address.x + 1, address.y + 1, address.lod);
    return { west: northWest.longitude, south: southEast.latitude, east: southEast.longitude, north: northWest.latitude };
}

/** Returns the extent of a tile in map pixels. */
export function tilePixelBounds(address: ITileAddress, metrics: ITileMetrics): IPixelBounds {
    const origin = metrics.getTileXYToPointXY(address.x, address.y);
    return { x: origin.x, y: origin.y, width: metrics.tileSize, height: metrics.tileSize };
}

/** Immutable location of a tile with mutable content. */
export class Tile<T> implements ITile<T> {
    public readonly address: ITileAddress;
    public readonly quadkey: string;
    public readonly namespace: string;
    public readonly key: string;
    public readonly geoBounds: IGeoBounds;
    public readonly pixelBounds: IPixelBounds;
    public content: T | undefined;

    /**
     * @param address - XYZ address.
     * @param metrics - Metrics of the pyramid, used to derive the bounds.
     * @param content - Optional content.
     * @param namespace - Pyramid identifier used in {@link key}.
     * @throws RangeError When the address lies outside its pyramid level.
     */
    public constructor(address: ITileAddress, metrics: ITileMetrics, content?: T, namespace = "") {
        assertValidTileAddress(address);
        this.address = { lod: address.lod, x: address.x, y: address.y };
        this.quadkey = tileAddressToQuadkey(this.address);
        this.namespace = namespace;
        this.key = `${namespace}:${this.quadkey}`;
        this.geoBounds = tileGeoBounds(this.address, metrics);
        this.pixelBounds = tilePixelBounds(this.address, metrics);
        this.content = content;
    }
}
