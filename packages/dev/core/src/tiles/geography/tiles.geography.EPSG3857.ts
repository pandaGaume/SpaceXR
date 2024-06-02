import { AbstractTileMetrics } from "../tiles.metrics";
import { IGeo2 } from "../../geography";
import { ICartesian2 } from "../../geometry";
import { Ellipsoid } from "../../geodesy/geodesy.ellipsoid";
import { Scalar } from "../../math/math";
import { ITileMetrics } from "../tiles.interfaces";

export class EPSG3857 extends AbstractTileMetrics {
    public static Shared = new EPSG3857();

    _ellipsoid: Ellipsoid;

    public constructor(options?: Partial<ITileMetrics>, ellipsoid?: Ellipsoid) {
        super(options);
        this._ellipsoid = ellipsoid || Ellipsoid.WGS84;
    }

    public groundResolution(latitude: number, levelOfDetail: number): number {
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        return (Math.cos(latitude * Scalar.DEG2RAD) * 2 * Math.PI * this._ellipsoid.semiMajorAxis) / this.mapSize(levelOfDetail);
    }

    public getLatLonToTileXYToRef(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): void {
        if (!tileXY) return;
        const t = tileXY;
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);

        const n = Math.pow(2, levelOfDetail);
        const x = Math.floor(((longitude + 180) / 360) * n);
        const lat_rad = latitude * Scalar.DEG2RAD;
        const y = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);
        t.x = x;
        t.y = y;
    }

    public getTileXYToLatLonToRef(x: number, y: number, levelOfDetail: number, loc?: IGeo2): void {
        if (!loc) return;
        const l = loc;
        let n = Math.pow(2, levelOfDetail);
        const lon = -180 + (x / n) * 360;
        n = Math.PI - (2 * Math.PI * y) / n;
        const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        l.lat = lat;
        l.lon = lon;
    }

    public getLatLonToPointXYToRef(latitude: number, longitude: number, levelOfDetail: number, pointXY: ICartesian2): void {
        if (!pointXY) return;
        const p = pointXY;
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);

        const x = (longitude + 180) / 360;
        const sinLatitude = Math.sin(latitude * Scalar.DEG2RAD);
        const y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

        const mapSize = this.mapSize(levelOfDetail);
        // The reason for adding 0.5 before casting to an integer is to round the floating-point value to the nearest integer.
        // Without this step, the cast to an integer would truncate the fractional component of the floating-point value towards zero.
        // This rounding step is necessary to ensure that the resulting point coordinates are centered on the cell,
        // as required by the cell-centered convention
        p.x = Math.ceil(Scalar.Clamp(x * mapSize + 0.5, 0, mapSize - 1));
        p.y = Math.ceil(Scalar.Clamp(y * mapSize + 0.5, 0, mapSize - 1));
    }

    public getPointXYToLatLonToRef(pointX: number, pointY: number, levelOfDetail: number, latLon: IGeo2): void {
        if (!latLon) return;

        const g = latLon;
        const mapSize = this.mapSize(levelOfDetail);
        const x = Scalar.Clamp(pointX, 0, mapSize - 1) / mapSize - 0.5;
        const y = 0.5 - Scalar.Clamp(pointY, 0, mapSize - 1) / mapSize;

        g.lat = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
        g.lon = 360 * x;
    }

    public getTileXYToPointXYToRef(tileX: number, tileY: number, pointXY: ICartesian2): void {
        if (!pointXY) return;
        const p = pointXY;
        const s = this.tileSize;
        p.x = tileX * s;
        p.y = tileY * s;
    }

    public getPointXYToTileXYToRef(pointX: number, pointY: number, tileXY: ICartesian2): void {
        if (!tileXY) return;
        const t = tileXY;
        const s = this.tileSize;
        t.x = Math.floor(pointX / s);
        t.y = Math.floor(pointY / s);
    }
}
