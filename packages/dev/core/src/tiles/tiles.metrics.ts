import { ICartesian2 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileMetrics, CellCoordinateReference } from "./tiles.interfaces";
import { TileSystemBounds } from "./tiles.system";
import { PropertyChangedEventArgs } from "../events";
import { Cartesian2 } from "../geometry";
import { Geo2 } from "../geography";
import { Scalar } from "../math";
import { Ellipsoid } from "../geodesy";

export class TileMetrics extends TileSystemBounds implements ITileMetrics {
    public static DefaultTileSize: number = 256;
    public static DefaultCellSize: number = 1;
    public static DefaultCoordinateReference: CellCoordinateReference = CellCoordinateReference.CENTER;
    public static DefaultOverlap: number = 0;

    private static _shared: TileMetrics | null = null;

    public static get Shared(): TileMetrics {
        return (this._shared ??= new TileMetrics());
    }

    _tileSize: number;
    _cellSize: number;
    _cellCoordinateReference: CellCoordinateReference;
    _overlap: number;

    _ellipsoid: Ellipsoid;

    public constructor(options?: Partial<ITileMetrics>, ellipsoid?: Ellipsoid) {
        super();
        // 1) set safe defaults
        this._tileSize = TileMetrics.DefaultTileSize;
        this._cellSize = TileMetrics.DefaultCellSize;
        this._cellCoordinateReference = TileMetrics.DefaultCoordinateReference;
        this._overlap = TileMetrics.DefaultOverlap;

        // 2) overlay only defined values from options
        if (options) {
            if (options.tileSize !== undefined) this._tileSize = options.tileSize;
            if (options.cellSize !== undefined) this._cellSize = options.cellSize;
            if (options.cellCoordinateReference !== undefined) this._cellCoordinateReference = options.cellCoordinateReference;
            if (options.overlap !== undefined) this._overlap = options.overlap;
        }

        this._ellipsoid = ellipsoid || Ellipsoid.WGS84;
    }

    public mapSize(levelOfDetail: number): number {
        const result = this.tileSize * Math.pow(2, levelOfDetail);
        return result >>> 0; // Convert to unsigned 32-bit integer
    }

    public get tileSize(): number {
        return this._tileSize;
    }

    public set tileSize(v: number) {
        if (this._tileSize !== v) {
            const old = this._tileSize;
            this._tileSize = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "tileSize"), -1, this, this);
        }
    }

    public get cellSize(): number {
        return this._cellSize;
    }

    public set cellSize(v: number) {
        if (this._cellSize !== v) {
            const old = this._cellSize;
            this._cellSize = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "cellSize"), -1, this, this);
        }
    }

    public get cellCoordinateReference(): CellCoordinateReference {
        return this._cellCoordinateReference;
    }

    public set cellCoordinateReference(v: CellCoordinateReference) {
        if (this._cellCoordinateReference !== v) {
            const old = this._cellCoordinateReference;
            this._cellCoordinateReference = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "cellCoordinateReference"), -1, this, this);
        }
    }

    public get overlap(): number {
        return this._overlap;
    }

    public set overlap(v: number) {
        if (this._overlap !== v) {
            const old = this._overlap;
            this._overlap = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "overlap"), -1, this, this);
        }
    }

    public mapScale(latitude: number, levelOfDetail: number, pixelPerUnit: number): number {
        if (pixelPerUnit === 0) return Infinity;
        const d = this.groundResolution(latitude, levelOfDetail);
        if (d === 0) return Infinity;
        return 1 / (d * pixelPerUnit);
    }

    public getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number): ICartesian2 {
        const c = Cartesian2.Zero();
        this.getLatLonToTileXYToRef(latitude, longitude, levelOfDetail, c);
        return c;
    }
    public getTileXYToLatLon(x: number, y: number, levelOfDetail: number): IGeo2 {
        const g = Geo2.Zero();
        this.getTileXYToLatLonToRef(x, y, levelOfDetail, g);
        return g;
    }
    public getLatLonToPointXY(latitude: number, longitude: number, levelOfDetail: number): ICartesian2 {
        const c = Cartesian2.Zero();
        this.getLatLonToPointXYToRef(latitude, longitude, levelOfDetail, c);
        return c;
    }
    public getPointXYToLatLon(x: number, y: number, levelOfDetail: number): IGeo2 {
        const g = Geo2.Zero();
        this.getPointXYToLatLonToRef(x, y, levelOfDetail, g);
        return g;
    }
    public getTileXYToPointXY(x: number, y: number): ICartesian2 {
        const c = Cartesian2.Zero();
        this.getTileXYToPointXYToRef(x, y, c);
        return c;
    }
    public getPointXYToTileXY(x: number, y: number): ICartesian2 {
        const c = Cartesian2.Zero();
        this.getPointXYToTileXYToRef(x, y, c);
        return c;
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

        p.x = Math.ceil(Scalar.Clamp(x * mapSize, 0, mapSize - 1));
        p.y = Math.ceil(Scalar.Clamp(y * mapSize, 0, mapSize - 1));
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
