import { ICartesian2 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileMetrics, CellCoordinateReference } from "./tiles.interfaces";
import { TileSystemBounds } from "./tiles.system";
import { PropertyChangedEventArgs } from "../events";
import { Cartesian2 } from "../geometry";
import { Geo2 } from "../geography";

export abstract class AbstractTileMetrics extends TileSystemBounds implements ITileMetrics {
    public static DefaultTileSize = 256;
    public static DefaultCellSize = 1;
    public static DefaultCoordinateReference = CellCoordinateReference.CENTER;
    public static DefaultOverlap = 0;

    _tileSize: number = AbstractTileMetrics.DefaultTileSize;
    _cellSize: number = AbstractTileMetrics.DefaultCellSize;
    _cellCoordinateReference: CellCoordinateReference = AbstractTileMetrics.DefaultCoordinateReference;
    _overlap: number = AbstractTileMetrics.DefaultOverlap;

    public constructor(options?: Partial<ITileMetrics>) {
        super(options);
    }

    public mapSize(levelOfDetail: number): number {
        return this.tileSize << levelOfDetail;
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

    public abstract groundResolution(latitude: number, levelOfDetail: number): number;

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

    public abstract getLatLonToTileXYToRef(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): void;
    public abstract getTileXYToLatLonToRef(x: number, y: number, levelOfDetail: number, latLon?: IGeo2 | undefined): void;
    public abstract getLatLonToPointXYToRef(latitude: number, longitude: number, levelOfDetail: number, pointXY?: ICartesian2): void;
    public abstract getPointXYToLatLonToRef(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): void;
    public abstract getTileXYToPointXYToRef(x: number, y: number, pointXY?: ICartesian2): void;
    public abstract getPointXYToTileXYToRef(x: number, y: number, tileXY?: ICartesian2): void;
}
