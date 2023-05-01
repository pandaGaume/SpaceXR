import { ITileAddress, ITileDirectory } from "../tiles/tiles.interfaces";
import { IEnvelope, IGeo2, ISize2 } from "../geography/geography.interfaces";
import { Envelope, WebMercatorTileMetrics } from "..";
export declare class MapLayer<T> {
    name: string;
    directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>;
    _enabled: boolean;
    _cache?: Array<number>;
    constructor(name: string, directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>);
    get enabled(): boolean;
    set enabled(v: boolean);
    validateTileKeys(bounds: Envelope, lod: number): void;
}
export declare class WebMercatorMap2<T> {
    _metrics: WebMercatorTileMetrics;
    _center: IGeo2;
    _size: ISize2;
    _levelOfDetail: number;
    _layers?: Map<string, MapLayer<T>>;
    _defaultLayer?: string;
    _env?: IEnvelope;
    constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: WebMercatorTileMetrics);
    get levelOfDetail(): number;
    get width(): number;
    get height(): number;
    get lat(): number;
    get lon(): number;
    zoom(v?: number): WebMercatorMap2<T>;
    resize(width: number, height: number): WebMercatorMap2<T>;
    center(lat?: number, lon?: number): WebMercatorMap2<T>;
    layers(predicate: (l: MapLayer<T>) => boolean): IterableIterator<MapLayer<T>>;
    addLayer(name: string, directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>): WebMercatorMap2<T>;
    removeLayer(name: string): void;
    invalidate(): WebMercatorMap2<T>;
    validate(): WebMercatorMap2<T>;
    private buildEnvelope;
}
