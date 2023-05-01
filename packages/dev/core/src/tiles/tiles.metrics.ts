import { ICartesian2, IGeo2 } from "../geography/geography.interfaces";
import { ITileAddress, ITileMetrics, ITileMetricsOptions} from "./tiles.interfaces";


export class TileMetricsOptions implements ITileMetricsOptions {
    public static DefaultTileSize = 256;
    public static DefaultLOD = 0;
    public static DefaultMinLOD = 0;
    public static DefaultMaxLOD = 23;
    public static DefaultMinLatitude = -85.05112878;
    public static DefaultMaxLatitude = 85.05112878;
    public static DefaultMinLongitude = -180;
    public static DefaultMaxLongitude = 180;

    public static Shared: TileMetricsOptions = {
        tileSize: TileMetricsOptions.DefaultTileSize,
        minLOD: TileMetricsOptions.DefaultMinLOD,
        maxLOD: TileMetricsOptions.DefaultMaxLOD,
        minLatitude: TileMetricsOptions.DefaultMinLatitude,
        maxLatitude: TileMetricsOptions.DefaultMaxLatitude,
        minLongitude: TileMetricsOptions.DefaultMinLongitude,
        maxLongitude: TileMetricsOptions.DefaultMaxLongitude
    };

    public constructor(
        public tileSize: number,
        public minLOD: number,
        public maxLOD: number,
        public minLatitude: number,
        public maxLatitude: number,
        public minLongitude: number,
        public maxLongitude: number
    ) {}
}

export class TileMetricsOptionsBuilder {
    _tileSize?: number;
    _minLOD?: number;
    _maxLOD?: number;
    _minLatitude?: number;
    _maxLatitude?: number;
    _minLongitude?: number;
    _maxLongitude?: number;

    public withTileSize(v?: number): TileMetricsOptionsBuilder {
        this._tileSize = v;
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
        return new TileMetricsOptions(
            this._tileSize || TileMetricsOptions.DefaultTileSize,
            this._minLOD || TileMetricsOptions.DefaultMinLOD,
            this._maxLOD || TileMetricsOptions.DefaultMaxLOD,
            this._minLatitude || TileMetricsOptions.DefaultMinLatitude,
            this._maxLatitude || TileMetricsOptions.DefaultMaxLatitude,
            this._minLongitude || TileMetricsOptions.DefaultMinLongitude,
            this._maxLongitude || TileMetricsOptions.DefaultMaxLongitude
        );
    }
}

export class TileMetrics {
    public static TileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): Uint8Array {
        const quadKey = new Uint8Array(levelOfDetail);
        let j = 0;
        for (let i = levelOfDetail; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((tileX & mask) != 0) {
                digit++;
            }
            if ((tileY & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey[j++] = digit;
        }
        return quadKey;
    }

    public static QuadKeyToTileXY(quadKey: Uint8Array): ITileAddress {
        let tileX = 0;
        let tileY = 0;
        const levelOfDetail = quadKey.length;
        for (let i = levelOfDetail; i > 0; i--) {
            const mask = 1 << (i - 1);
            switch (quadKey[levelOfDetail - i]) {
                case 0:
                    break;

                case 1:
                    tileX |= mask;
                    break;

                case 2:
                    tileY |= mask;
                    break;

                case 3:
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

    public get tileSize(): number {
        return this._o.tileSize || TileMetricsOptions.DefaultTileSize;
    }
    public get minLOD(): number {
        return this._o.minLOD || TileMetricsOptions.DefaultMinLOD;
    }
    public get maxLOD(): number {
        return this._o.maxLOD || TileMetricsOptions.DefaultMaxLOD;
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

    public assertValidAddress(x: number, y: number, levelOfDetail: number): void {
        if (levelOfDetail < 0 || levelOfDetail > this.maxLOD) {
            throw new Error(`Invalid levelOfDetail ${levelOfDetail}`);
        }
        const s = (0x01 << levelOfDetail) - 1;
        if (x < 0 || x > s) {
            throw new Error(`Invalid x ${x}, must be in [0,${s}] range.`);
        }
        if (y < 0 || y > s) {
            throw new Error(`Invalid y ${y}, must be in [0,${s}] range.`);
        }
    }

    public abstract mapScale(latitude: number, levelOfDetail: number, dpi: number): number;
    public abstract groundResolution(latitude: number, levelOfDetail: number): number;

    public abstract getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    public abstract getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2 | undefined): IGeo2;
    public abstract getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    public abstract getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    public abstract getTileXYToPixelXY(x: number, y: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    public abstract getPixelXYToTileXY(x: number, y: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;
}
