import { GeodeticSystem, type ICartesian3 } from "@spacexr/geodesy";

import { assertValidTileAddress, formatTileAddress, tileCount, type ITileAddress } from "./tile-address";

export type { ICartesian3 };

/** How tiles share one shape: tiles of the same `key` are the same shape turned about the `Z` axis by `rotation`. */
export interface ITileShapeFrame {
    /** Identifies the shape among the tiles of a surface. */
    readonly key: string;
    /** Angle about the `Z` axis from the frame of the shape to the body-fixed frame, in radians. */
    readonly rotation: number;
}

/**
 * Places the tiles of a pyramid on a body: the part of a tiling scheme that geometry needs. Positions are Cartesian,
 * in metres, in the body-fixed frame. Tile coordinates `s` and `t` run in `[0, 1]`, `s` along the tile `x` axis and
 * `t` along its `y` axis.
 */
export interface ITileSurface {
    /**
     * Point of a tile at a height above the reference surface, along {@link up}.
     *
     * @param height - Height in metres. Defaults to 0.
     * @param target - Receives the point.
     * @throws RangeError When the address does not belong to the surface.
     */
    point(address: ITileAddress, s: number, t: number, height?: number, target?: ICartesian3): ICartesian3;

    /**
     * Unit vector along which heights move a point of the tile.
     *
     * @param target - Receives the vector.
     * @throws RangeError When the address does not belong to the surface.
     */
    up(address: ITileAddress, s: number, t: number, target?: ICartesian3): ICartesian3;

    /**
     * Shape shared by a tile with others.
     *
     * @throws RangeError When the address does not belong to the surface.
     */
    shape(address: ITileAddress): ITileShapeFrame;
}

/**
 * Tiles of a Web Mercator pyramid on an ellipsoid. Heights are geodetic, along the normal of the ellipsoid. Tiles of
 * one level and row are the same shape turned about the polar axis.
 */
export class WebMercatorTileSurface implements ITileSurface {
    /** @param system - Geodetic system of the ellipsoid. Defaults to WGS84. */
    public constructor(private readonly system: GeodeticSystem = GeodeticSystem.WGS84) {}

    public point(address: ITileAddress, s: number, t: number, height = 0, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        this.assertAddress(address);
        const count = tileCount(address.lod);
        return this.system.geodeticRadiansToEcef(latitudeOf((address.y + t) / count), longitudeOf((address.x + s) / count), height, target);
    }

    public up(address: ITileAddress, s: number, t: number, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        this.assertAddress(address);
        const count = tileCount(address.lod);
        const latitude = latitudeOf((address.y + t) / count);
        const longitude = longitudeOf((address.x + s) / count);
        target.x = Math.cos(latitude) * Math.cos(longitude);
        target.y = Math.cos(latitude) * Math.sin(longitude);
        target.z = Math.sin(latitude);
        return target;
    }

    public shape(address: ITileAddress): ITileShapeFrame {
        this.assertAddress(address);
        return { key: `${address.lod}/${address.y}`, rotation: longitudeOf((address.x + 0.5) / tileCount(address.lod)) };
    }

    private assertAddress(address: ITileAddress): void {
        assertValidTileAddress(address);
        if (address.face) throw new RangeError(`Tile ${formatTileAddress(address)} does not exist: a Web Mercator pyramid has one root.`);
    }
}

/** Latitude in radians of a Web Mercator ordinate, southward in `[0, 1]` over the whole pyramid. */
function latitudeOf(y: number): number {
    return Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
}

/** Longitude in radians of a Web Mercator abscissa, eastward in `[0, 1]` over the whole pyramid. */
function longitudeOf(x: number): number {
    return (2 * x - 1) * Math.PI;
}
