import { ILocation, ITileMetrics, ITileMetricsOptions, IVector2 } from "./tiles.interfaces";

export class TileMetricsOptions implements ITileMetricsOptions {
    public static DefaultTileSize: 256;
    public static DefaultMinLOD: 0;
    public static DefaultMaxLOD: 23;
    public static DefaultMinLatitude: -85.05112878;
    public static DefaultMaxLatitude: 85.05112878;
    public static DefaultMinLongitude: -180;
    public static DefaultMaxLongitude: 180;

    public static Shared: TileMetricsOptions = {
        tileSize: TileMetricsOptions.DefaultTileSize,
        minLOD: TileMetricsOptions.DefaultMinLOD,
        maxLOD: TileMetricsOptions.DefaultMaxLOD,
        minLatitude: TileMetricsOptions.DefaultMinLatitude,
        maxLatitude: TileMetricsOptions.DefaultMaxLatitude,
        minLongitude: TileMetricsOptions.DefaultMinLongitude,
        maxLongitude: TileMetricsOptions.DefaultMaxLongitude,
    };

    public tileSize?: number;
    public minLOD?: number;
    public maxLOD?: number;
    public minLatitude?: number;
    public maxLatitude?: number;
    public minLongitude?: number;
    public maxLongitude?: number;
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
        const o: TileMetricsOptions = {
            tileSize: this._tileSize,
            minLOD: this._minLOD,
            maxLOD: this._maxLOD,
            minLatitude: this._minLatitude,
            maxLatitude: this._maxLatitude,
            minLongitude: this._minLongitude,
            maxLongitude: this._maxLongitude,
        };
        return o;
    }
}

export class TileMetricsBase implements ITileMetrics {
    private static Clamp(value: number, min?: number, max?: number): number {
        if (min) {
            value = Math.max(min, value);
        }
        if (max) {
            value = Math.min(max, value);
        }
        return value;
    }

    _o: TileMetricsOptions;

    public constructor(options?: Partial<TileMetricsOptions>) {
        this._o = { ...TileMetricsOptions.Shared, ...options };
    }

    public get options(): TileMetricsOptions {
        return this._o;
    }

    public set options(value: Partial<TileMetricsOptions>) {
        this._o = { ...TileMetricsOptions.Shared, ...value };
    }

    public get tileSize(): number {
        return this._o.tileSize || TileMetricsOptions.DefaultTileSize;
    }

    public set tileSize(s: number) {
        this._o.tileSize = s;
    }

    public getMapSize(levelOfDetail: number): number {
        return this.tileSize << TileMetricsBase.Clamp(levelOfDetail, this._o.minLOD, this._o.maxLOD);
    }

    public getGroundResolution(latitude: number, levelOfDetail: number, radius: number): number {
        latitude = TileMetricsBase.Clamp(latitude, this._o.minLatitude, this._o.maxLatitude);
        return (Math.cos((latitude * Math.PI) / 180) * 2 * Math.PI * radius) / this.getMapSize(levelOfDetail);
    }

    public getMapScale(latitude: number, levelOfDetail: number, screenDpi: number, radius: number): number {
        return (this.getGroundResolution(latitude, levelOfDetail, radius) * screenDpi) / 0.0254; //  0.0254 is the inches to meters factor.
    }

    public getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixel?: IVector2): IVector2 {
        pixel = pixel || <IVector2>{ x: 0, y: 0 };
        latitude = TileMetricsBase.Clamp(latitude, this._o.minLatitude, this._o.maxLatitude);
        longitude = TileMetricsBase.Clamp(longitude, this._o.minLongitude, this._o.maxLongitude);

        const x: number = (longitude + 180) / 360;
        const sinLatitude: number = Math.sin((latitude * Math.PI) / 180);
        const y: number = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

        const mapSize: number = this.getMapSize(levelOfDetail);
        pixel.x = TileMetricsBase.Clamp(x * mapSize + 0.5, 0, mapSize - 1);
        pixel.y = TileMetricsBase.Clamp(y * mapSize + 0.5, 0, mapSize - 1);

        return pixel;
    }

    public getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2): IVector2 {
        const v = this.getLatLonToPixelXY(latitude, longitude, levelOfDetail, tileXY);
        const s: number = this.tileSize;
        v.x = Math.floor(v.x / s);
        v.y = Math.floor(v.y / s);
        return v;
    }

    public getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, pos?: ILocation): ILocation {
        pos = pos || <ILocation>{ lat: 0, lon: 0 };

        const mapSize: number = this.getMapSize(levelOfDetail);
        x = TileMetricsBase.Clamp(x, 0, mapSize - 1) / mapSize - 0.5;
        y = 0.5 - TileMetricsBase.Clamp(y, 0, mapSize - 1) / mapSize;

        pos.lat = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
        pos.lon = 360 * x;
        return pos;
    }

    public getPixelXYToTileXY(x: number, y: number, tile?: IVector2): IVector2 {
        tile = tile || <IVector2>{ x: 0, y: 0 };
        const s: number = this.tileSize;
        tile.x = Math.floor(x / s);
        tile.y = Math.floor(y / s);
        return tile;
    }

    public getTileXYToPixelXY(x: number, y: number, pixel?: IVector2): IVector2 {
        pixel = pixel || <IVector2>{ x: 0, y: 0 };
        const s: number = this.tileSize;
        pixel.x = x * s;
        pixel.y = y * s;
        return pixel;
    }

    public getTileXYToLatLon(x: number, y: number, levelOfDetail: number, pos?: ILocation): ILocation {
        const pixel: IVector2 = this.getTileXYToPixelXY(x, y);
        return this.getPixelXYToLatLon(pixel.x, pixel.y, levelOfDetail);
    }
}
