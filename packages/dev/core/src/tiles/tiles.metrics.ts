import { ICartesian2, ICartesian3 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileAddress, ITileMetrics, ITileMetricsOptions, CellCoordinateReference } from "./tiles.interfaces";
import { TileAddress } from "./tiles.address";
import { Nullable } from "../types";
import { Scalar } from "../math/math";

export class TileMetricsOptions implements ITileMetricsOptions {
    public static DefaultTileSize = 256;
    public static DefaultLOD = 0;
    public static DefaultMinLOD = 0;
    public static DefaultMaxLOD = 23;
    public static DefaultMinLatitude = -85.05112878;
    public static DefaultMaxLatitude = 85.05112878;
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

export class TileMetrics {
    public static IsValidAddress(a: ITileAddress, metrics: ITileMetrics): boolean {
        if (!TileMetrics.IsValidLod(a.levelOfDetail, metrics)) {
            return false;
        }
        const s = (0x01 << a.levelOfDetail) - 1;
        if (a.x < 0 || a.x > s) {
            return false;
        }
        if (a.y < 0 || a.y > s) {
            return false;
        }
        return true;
    }

    public static AssertValidAddress(a: ITileAddress, metrics: ITileMetrics): void {
        if (!TileMetrics.IsValidLod(a.levelOfDetail, metrics)) {
            throw new Error(`Invalid levelOfDetail ${a.levelOfDetail}`);
        }
        const s = (0x01 << a.levelOfDetail) - 1;
        if (a.x < 0 || a.x > s) {
            throw new Error(`Invalid x ${a.x}, must be in [0,${s}] range.`);
        }
        if (a.y < 0 || a.y > s) {
            throw new Error(`Invalid y ${a.y}, must be in [0,${s}] range.`);
        }
    }

    public static IsValidLod(lod: number, metrics: ITileMetrics): boolean {
        return lod >= metrics.minLOD && lod <= metrics.maxLOD;
    }

    public static ClampLod(levelOfDetail: number, metrics: ITileMetrics): number {
        return Scalar.Clamp(levelOfDetail, metrics.minLOD, metrics.maxLOD);
    }

    public static GetLodScale(lod: number): number {
        let lodOffset = (lod * 1000 - Math.round(lod) * 1000) / 1000; // Trick to avoid floating point error.
        // scale corresponding to the decimal part
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        return scale;
    }

    public static ToParentKey(key: string): string {
        return key && key.length > 1 ? key.substring(0, key.length - 1) : key;
    }

    /// <summary>
    /// Returns the normalized section of the quadkey in the form of Vector3(x,y,z) where x,y,z are in [0,1] range
    /// and define the upper left corner of the section.
    /// </summary>
    public static ToNormalizedSection(key: string): Nullable<ICartesian3> {
        if (key === null || key === undefined || key.length <= 1) {
            return null;
        }
        const c = key.charAt(key.length - 1);
        let s: ICartesian3 = { x: 0, y: 0, z: 0.5 };
        switch (c) {
            case "1": {
                s.x = s.z;
                break;
            }
            case "2": {
                s.y = s.z;
                break;
            }
            case "3": {
                s.x = s.y = s.z;
                break;
            }
        }
        return s;
    }
    public static ToChildsKey(key: string): string[] {
        key = key || "";
        return [key.slice() + "0", key.slice() + "1", key.slice() + "2", key.slice() + "3"];
    }

    public static ToNeigborsKey(key: string): Nullable<string>[] {
        return TileMetrics.ToNeigborsXY(TileMetrics.QuadKeyToTileXY(key)).map((a) => (a ? TileMetrics.TileXYToQuadKey(a) : null));
    }

    public static ToNeigborsXY(a: ITileAddress): Nullable<ITileAddress>[] {
        const max = Math.pow(2, a.levelOfDetail);
        const n = [
            new TileAddress(a.x - 1, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x + 1, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x - 1, a.y, a.levelOfDetail),
            a,
            new TileAddress(a.x + 1, a.y, a.levelOfDetail),
            new TileAddress(a.x - 1, a.y + 1, a.levelOfDetail),
            new TileAddress(a.x, a.y + 1, a.levelOfDetail),
            new TileAddress(a.x + 1, a.y + 1, a.levelOfDetail),
        ];
        return n.map((ad) => (ad.x >= 0 && ad.y >= 0 && ad.x < max && ad.y < max ? ad : null));
    }

    public static TileXYToQuadKey(a: ITileAddress): string {
        let quadKey = "";
        for (let i = a.levelOfDetail; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((a.x & mask) != 0) {
                digit++;
            }
            if ((a.y & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey = quadKey + digit;
        }
        return quadKey;
    }

    public static QuadKeyToTileXY(quadKey: string): ITileAddress {
        let tileX = 0;
        let tileY = 0;
        const levelOfDetail = quadKey.length;
        for (let i = levelOfDetail; i > 0; i--) {
            const mask = 1 << (i - 1);
            switch (quadKey[levelOfDetail - i]) {
                case "0":
                    break;

                case "1":
                    tileX |= mask;
                    break;

                case "2":
                    tileY |= mask;
                    break;

                case "3":
                    tileX |= mask;
                    tileY |= mask;
                    break;

                default:
                    throw new Error("Invalid QuadKey digit sequence.");
            }
        }
        return <ITileAddress>{ x: tileX, y: tileY, levelOfDetail: levelOfDetail };
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
