import { ICartesian2 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsOptions, CellCoordinateReference } from "./tiles.interfaces";
import { Projections } from "../geography/geography.projections";

export class TileMetricsOptions implements ITileMetricsOptions {
    public static DefaultTileSize = 256;
    public static DefaultLOD = 0;
    public static DefaultMinLOD = 0;
    public static DefaultMaxLOD = 23;
    public static DefaultMinLatitude = Projections.WebMercatorMinLatitude;
    public static DefaultMaxLatitude = Projections.WebMercatorMaxLatitude;
    public static DefaultMinLongitude = -180;
    public static DefaultMaxLongitude = 180;
    public static DefaultCellSize = 1;
    public static DefaultCoordinateReference = CellCoordinateReference.center;
    public static DefaultOverlap = 0;

    minLOD?: number;
    maxLOD?: number;
    minLatitude?: number;
    maxLatitude?: number;
    minLongitude?: number;
    maxLongitude?: number;

    tileSize?: number;
    cellSize?: number;
    cellCoordinateReference?: CellCoordinateReference;
    overlap?: number;

    public static Shared: TileMetricsOptions = {
        tileSize: TileMetricsOptions.DefaultTileSize,
        minLOD: TileMetricsOptions.DefaultMinLOD,
        maxLOD: TileMetricsOptions.DefaultMaxLOD,
        minLatitude: TileMetricsOptions.DefaultMinLatitude,
        maxLatitude: TileMetricsOptions.DefaultMaxLatitude,
        minLongitude: TileMetricsOptions.DefaultMinLongitude,
        maxLongitude: TileMetricsOptions.DefaultMaxLongitude,
        cellSize: TileMetricsOptions.DefaultCellSize,
        cellCoordinateReference: TileMetricsOptions.DefaultCoordinateReference,
        overlap: TileMetricsOptions.DefaultOverlap,
    };

    public constructor(p: Partial<TileMetricsOptions>) {
        Object.assign(this, p);
    }
}

export class TileMetricsOptionsBuilder {
    _minLOD?: number;
    _maxLOD?: number;
    _minLatitude?: number;
    _maxLatitude?: number;
    _minLongitude?: number;
    _maxLongitude?: number;

    _tileSize?: number;
    _cellSize?: number;
    _cellCoordinateReference?: CellCoordinateReference;
    _overlap?: number;

    public withTileSize(v?: number): TileMetricsOptionsBuilder {
        this._tileSize = v;
        return this;
    }
    public withCellSize(v?: number): TileMetricsOptionsBuilder {
        this._cellSize = v;
        return this;
    }
    public withCellCoordinateReference(v?: CellCoordinateReference): TileMetricsOptionsBuilder {
        this._cellCoordinateReference = v;
        return this;
    }
    public withTOverlap(v?: number): TileMetricsOptionsBuilder {
        this._overlap = v;
        return this;
    }
    public withMinLOD(v?: number): TileMetricsOptionsBuilder {
        this._minLOD = v;
        return this;
    }
    public withMaxLOD(v?: number): TileMetricsOptionsBuilder {
        this._maxLOD = v;
        return this;
    }
    public withMinLatitude(v?: number): TileMetricsOptionsBuilder {
        this._minLatitude = v;
        return this;
    }
    public withMaxLatitude(v?: number): TileMetricsOptionsBuilder {
        this._maxLatitude = v;
        return this;
    }
    public withMinLongitude(v?: number): TileMetricsOptionsBuilder {
        this._minLongitude = v;
        return this;
    }
    public withMaxLongitude(v?: number): TileMetricsOptionsBuilder {
        this._maxLongitude = v;
        return this;
    }

    public build(): ITileMetricsOptions {
        return new TileMetricsOptions({
            tileSize: this._tileSize,
            minLOD: this._minLOD,
            maxLOD: this._maxLOD,
            minLatitude: this._minLatitude,
            maxLatitude: this._maxLatitude,
            minLongitude: this._minLongitude,
            maxLongitude: this._maxLongitude,
            cellSize: this._cellSize,
            cellCoordinateReference: this._cellCoordinateReference,
            overlap: this._overlap,
        });
    }
}

export abstract class AbstractTileMetrics implements ITileMetrics {
    _o: TileMetricsOptions;

    public constructor(options?: Partial<TileMetricsOptions>) {
        this._o = { ...TileMetricsOptions.Shared, ...options };
    }

    public get options(): TileMetricsOptions {
        return this._o;
    }

    public mapSize(levelOfDetail: number): number {
        return this.tileSize << levelOfDetail;
    }

    public get minLOD(): number {
        return this._o.minLOD || TileMetricsOptions.DefaultMinLOD;
    }
    public get maxLOD(): number {
        return this._o.maxLOD || TileMetricsOptions.DefaultMaxLOD;
    }
    public get lodCount(): number {
        return this.maxLOD - this.minLOD + 1;
    }
    public get minLatitude(): number {
        return this._o.minLatitude || TileMetricsOptions.DefaultMinLatitude;
    }
    public get maxLatitude(): number {
        return this._o.maxLatitude || TileMetricsOptions.DefaultMaxLatitude;
    }
    public get minLongitude(): number {
        return this._o.minLongitude || TileMetricsOptions.DefaultMinLongitude;
    }
    public get maxLongitude(): number {
        return this._o.maxLongitude || TileMetricsOptions.DefaultMaxLongitude;
    }

    public get tileSize(): number {
        return this._o.tileSize || TileMetricsOptions.DefaultTileSize;
    }
    public get cellSize(): number {
        return this._o.cellSize || TileMetricsOptions.DefaultCellSize;
    }
    public get cellCoordinateReference(): CellCoordinateReference {
        return this._o.cellCoordinateReference || TileMetricsOptions.DefaultCoordinateReference;
    }
    public get overlap(): number {
        return this._o.overlap || TileMetricsOptions.DefaultOverlap;
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
