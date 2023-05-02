import { ITile, ITileAddress, ITileDirectory } from "../tiles/tiles.interfaces";
import { IGeo2, ISize2 } from "../geography/geography.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Size2 } from "../geography/geography.size";
import { Scalar } from "../math/math";
import { WebMercatorTileMetrics } from "..";
import { Observable } from "../events/events.observable";

export class MapLayer<T> {
    public static ValidateTileKeys(lat: number, lon: number, lod: number, width: number, height: number, metrics: WebMercatorTileMetrics): number[] {
        const cache = [];

        const pixelCenterXY = metrics.getLatLonToPixelXY(lat, lon, lod);
        const halfWitdh = width / 2;
        const halfHeight = height / 2;
        const x0 = Math.round(pixelCenterXY.x - halfWitdh);
        const y0 = Math.round(pixelCenterXY.y - halfHeight);
        const x1 = Math.round(pixelCenterXY.x + halfWitdh);
        const y1 = Math.round(pixelCenterXY.y + halfHeight);

        const tileXY0 = metrics.getPixelXYToTileXY(x0, y0, lod);
        const tileXY1 = metrics.getPixelXYToTileXY(x1, y1, lod);

        for (let y = tileXY0.y; y <= tileXY1.y; y++) {
            for (let x = tileXY0.x; x <= tileXY1.x; x++) {
                const p = metrics.getTileXYToPixelXY(x, y, lod);
                cache.push(x, y, lod, p.x - x0, p.y - y0);
            }
        }
        return cache;
    }

    _enabled: boolean;
    _cache?: Array<number>;

    constructor(public name: string, public directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>) {
        this._enabled = true;
    }

    get metrics(): WebMercatorTileMetrics {
        return this.directory.metrics;
    }
}

export enum TileMapEventType {
    added,
    removed,
}

export interface ITileMapEvent<T> extends ITileAddress {
    type: TileMapEventType;
    directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>;
    x: number;
    y: number;
}

export class WebMercatorMap2<T> {
    // map metrics
    _metrics: WebMercatorTileMetrics;
    _center: IGeo2 = Geo2.Default;
    _size: ISize2 = Size2.Zero();
    _levelOfDetail: number = 0;

    // layers of data
    _layers: Map<string, MapLayer<T>>;
    _valid: boolean;
    _tileObservable?: Observable<ITileMapEvent<T>>;

    public constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: WebMercatorTileMetrics) {
        this._metrics = metrics || WebMercatorTileMetrics.Shared;
        this.zoom(levelOfDetail).resize(width, height).center(lat, lon);
        this._valid = false;
        this._layers = new Map<string, MapLayer<T>>();
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

    public setEnabledLayer(v: boolean, ...names: string[]): WebMercatorMap2<T> {
        for (const n of names) {
            const l = this._layers.get(n);
            if (l && l._enabled !== v) {
                this._setEnabledLayer(v, l);
            }
        }
        return this;
    }

    public *layers(predicate: (l: MapLayer<T>) => boolean): IterableIterator<MapLayer<T>> {
        for (const l of this._layers.values()) {
            if (!predicate || predicate(l)) {
                yield l;
            }
        }
    }

    public addLayer(name: string, directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>, enabled: boolean = false): WebMercatorMap2<T> {
        if (!this._layers.has(name)) {
            const l = new MapLayer(name, directory);
            this._layers.set(name, l);
            this._setEnabledLayer(enabled, l);
        }
        return this;
    }

    public removeLayer(name: string): WebMercatorMap2<T> {
        this._layers?.delete(name);
        return this;
    }

    public invalidate(): WebMercatorMap2<T> {
        this._valid = false;
        return this;
    }

    public validate(): WebMercatorMap2<T> {
        if (!this._valid) {
            if (this._layers) {
                for (const l of this._layers.values()) {
                    this._setEnabledLayer(true, l);
                }
            }
            this._valid = true;
        }
        return this;
    }

    private _setEnabledLayer(v: boolean, l: MapLayer<T>) {
        if (v) {
            const keys = MapLayer.ValidateTileKeys(this.lat, this.lon, this.levelOfDetail, this.width, this.height, l.metrics);
            l._cache = keys;
        } else {
            l._cache = undefined;
        }
        l._enabled = v;
    }
}
