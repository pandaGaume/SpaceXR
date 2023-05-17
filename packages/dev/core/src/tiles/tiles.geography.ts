import { AbstractTileMetrics } from "./tiles.metrics";
import { IGeo2 } from "../geography/geography.interfaces";
import { ICartesian2 } from "../geometry/geometry.interfaces";
import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { Scalar } from "../math/math";
import { Geo2 } from "../geography/geography.position";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { ITileMetricsOptions } from "./tiles.interfaces";

export class EPSG3857 extends AbstractTileMetrics {
    public static Shared = new EPSG3857();

    _ellipsoid: Ellipsoid;

    public constructor(options?: ITileMetricsOptions, ellipsoid?: Ellipsoid) {
        super(options);
        this._ellipsoid = ellipsoid || Ellipsoid.WGS84;
    }

    public mapScale(latitude: number, levelOfDetail: number, dpi: number): number {
        // remember here that Ellipsoid unit are meters
        return this.groundResolution(latitude, levelOfDetail) * dpi * Scalar.INCH2METER;
    }

    public groundResolution(latitude: number, levelOfDetail: number): number {
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        return (Math.cos(latitude * Scalar.DEG2RAD) * 2 * Math.PI * this._ellipsoid.semiMajorAxis) / this.mapSize(levelOfDetail);
    }

    public getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2 {
        const t = tileXY || Cartesian2.Zero();
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);

        const n = Math.pow(2, levelOfDetail);
        const x = Math.floor(((longitude + 180) / 360) * n);
        const lat_rad = latitude * Scalar.DEG2RAD;
        const y = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);
        t.x = x;
        t.y = y;
        return t;
    }

    public getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo2): IGeo2 {
        const l = loc || Geo2.Zero();
        let n = Math.pow(2, levelOfDetail);
        const lon = -180 + (x / n) * 360;
        n = Math.PI - (2 * Math.PI * y) / n;
        const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        l.lat = lat;
        l.lon = lon;
        return l;
    }

    public getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2 {
        const p = pixelXY || Cartesian2.Zero();
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);

        const x = (longitude + 180) / 360;
        const sinLatitude = Math.sin(latitude * Scalar.DEG2RAD);
        const y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

        const mapSize = this.mapSize(levelOfDetail);
        // The reason for adding 0.5 before casting to an integer is to round the floating-point value to the nearest integer.
        // Without this step, the cast to an integer would truncate the fractional component of the floating-point value towards zero.
        // This rounding step is necessary to ensure that the resulting pixel coordinates are centered on the cell,
        // as required by the cell-centered convention
        p.x = Math.round(Scalar.Clamp(x * mapSize + 0.5, 0, mapSize - 1));
        p.y = Math.round(Scalar.Clamp(y * mapSize + 0.5, 0, mapSize - 1));
        return p;
    }

    public getPixelXYToLatLon(pixelX: number, pixelY: number, levelOfDetail: number, latLon?: IGeo2): IGeo2 {
        const g = latLon || Geo2.Zero();
        const mapSize = this.mapSize(levelOfDetail);
        const x = Scalar.Clamp(pixelX, 0, mapSize - 1) / mapSize - 0.5;
        const y = 0.5 - Scalar.Clamp(pixelY, 0, mapSize - 1) / mapSize;

        g.lat = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
        g.lon = 360 * x;
        return g;
    }

    public getTileXYToPixelXY(tileX: number, tileY: number, pixelXY?: ICartesian2): ICartesian2 {
        const p = pixelXY || Cartesian2.Zero();
        const s = this.tileSize;
        p.x = tileX * s;
        p.y = tileY * s;
        return p;
    }

    public getPixelXYToTileXY(pixelX: number, pixelY: number, tileXY?: ICartesian2): ICartesian2 {
        const t = tileXY || Cartesian2.Zero();
        const s = this.tileSize;
        t.x = Math.floor(pixelX / s);
        t.y = Math.floor(pixelY / s);
        return t;
    }
}
