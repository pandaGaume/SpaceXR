import { ICartesian2 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileMetrics, CellCoordinateReference } from "./tiles.interfaces";
import { TileSystemBounds } from "./tile.system";
import { PropertyChangedEventArgs } from "../events";

export abstract class AbstractTileMetrics extends TileSystemBounds implements ITileMetrics {
    public static DefaultTileSize = 256;
    public static DefaultCellSize = 1;
    public static DefaultCoordinateReference = CellCoordinateReference.center;
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
        return 1 / (this.groundResolution(latitude, levelOfDetail) * pixelPerUnit);
    }

    public abstract groundResolution(latitude: number, levelOfDetail: number): number;
    public abstract getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    public abstract getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2 | undefined): IGeo2;
    public abstract getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    public abstract getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    public abstract getTileXYToPixelXY(x: number, y: number, pixelXY?: ICartesian2): ICartesian2;
    public abstract getPixelXYToTileXY(x: number, y: number, tileXY?: ICartesian2): ICartesian2;
}
