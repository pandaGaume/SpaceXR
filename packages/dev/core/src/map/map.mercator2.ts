import { ITileAddress, ITileDirectory } from "../tiles/tiles.interfaces";
import { IEnvelope, IGeo2, ISize2 } from "../geography/geography.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Size2 } from "../geography/geography.size";
import { Scalar } from "../math/math";
import { Envelope, WebMercatorTileMetrics } from "..";

export class MapLayer<T> {
    _enabled: boolean;
    _cache?: Array<number>;

    constructor(public name: string, public directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>) {
        this._enabled = true;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(v: boolean) {
        if (v != this._enabled) {
            this._enabled = false;
            if (!this._enabled) {
                this._cache = undefined;
            }
        }
    }

    // tile keys are cached as tilex, tiley, lod, pixelx, pixely
    public validateTileKeys(bounds: Envelope, lod: number) {
        if (bounds) {
            const cache = [];
            const nw = bounds.nw;
            const se = bounds.se;
            const nwTileXY = this.directory.metrics.getLatLonToTileXY(nw.lat, nw.lon, lod);
            const seTileXY = this.directory.metrics.getLatLonToTileXY(se.lat, se.lon, lod);
            for (let y = nwTileXY.y; y <= seTileXY.y; y++) {
                for (let x = nwTileXY.x; x <= seTileXY.x; x++) {
                    const p = this.directory.metrics.getTileXYToPixelXY(x, y, lod);
                    cache.push(x, y, lod, p.x, p.y);
                }
            }
            this._cache = cache;
        }
    }
}

export class WebMercatorMap2<T> {
    // map metrics
    _metrics:WebMercatorTileMetrics;
    _center: IGeo2 = Geo2.Default;
    _size: ISize2 = Size2.Zero();
    _levelOfDetail: number = 0;

    // layers of data
    _layers?: Map<string, MapLayer<T>>;
    _defaultLayer?: string;

    // bounds
    _env?: IEnvelope;

    public constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?:WebMercatorTileMetrics) {
        this._metrics = metrics || WebMercatorTileMetrics.Shared;
        this.zoom(levelOfDetail).resize(width, height).center(lat, lon);
    }

    public get levelOfDetail(): number {
        return this._levelOfDetail;
    }

    public get width(): number {
        return this._size.width;
    }

    public get height(): number {
        return this._size.height;
    }

    public get lat(): number {
        return this._center.lat;
    }

    public get lon(): number {
        return this._center.lon;
    }

    public zoom(v?: number): WebMercatorMap2<T> {
        this._levelOfDetail = Scalar.Clamp(v || 0, this._metrics.minLOD, this._metrics.maxLOD);
        return this.invalidate();
    }

    public resize(width: number, height: number): WebMercatorMap2<T> {
        this._size = new Size2(Math.abs(width), Math.abs(height));
        return this.invalidate();
    }

    public center(lat?: number, lon?: number): WebMercatorMap2<T> {
        const latitude = Scalar.Clamp(lat || Geo2.Default.lat, this._metrics.minLatitude, this._metrics.maxLatitude);
        const longitude = Scalar.Clamp(lon || Geo2.Default.lon, this._metrics.minLongitude, this._metrics.maxLongitude);
        this._center = new Geo2(latitude, longitude);
        return this.invalidate();
    }

    public *layers(predicate: (l: MapLayer<T>) => boolean): IterableIterator<MapLayer<T>> {
        if (this._layers) {
            for (const l of this._layers.values()) {
                if (!predicate || predicate(l)) {
                    yield l;
                }
            }
        }
    }

    public addLayer(name: string, directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>): WebMercatorMap2<T> {
        if (!this._layers?.has(name)) {
            this._layers?.set(name, new MapLayer(name, directory));
        }
        return this;
    }

    public removeLayer(name: string) {
        this._layers?.delete(name);
    }

    public invalidate(): WebMercatorMap2<T> {
        this._env = undefined;
        return this;
    }

    public validate(): WebMercatorMap2<T> {
        if (this._env === undefined) {
            this._env = this.buildEnvelope();
        }
        return this;
    }

    /**
     * building this envelope is based on lat,lon of the center, assuming lat/lon reference is in the middle of the pixel,
     * an tile map origin is upper left.
     */
    private buildEnvelope(): IEnvelope {
        const xy = this._metrics.getLatLonToPixelXY(this.lat, this.lon, this.levelOfDetail);
        const w2 = this.width / 2;
        const h2 = this.height / 2;
        // pixel can NOT be divide by 2 when size is even (which is mostly the case in tile metrics).
        // so we need to offset the lower pixel corner, according the fact that the origin is up/left
        const woffset = 1 - (this.width % 2);
        const hoffset = 1 - (this.height % 2);
        const x0 = xy.x - w2;
        const x1 = xy.x + w2 - woffset;
        const y0 = xy.y - h2;
        const y1 = xy.y + h2 - hoffset;
        const nw = this._metrics.getPixelXYToLatLon(x0, y0, this.levelOfDetail);
        const se = this._metrics.getPixelXYToLatLon(x1, y1, this.levelOfDetail);
        return Envelope.FromPoints(nw, se);
    }
}
