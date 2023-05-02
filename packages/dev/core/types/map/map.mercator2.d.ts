import { ITileAddress, ITileDirectory } from "../tiles/tiles.interfaces";
import { IGeo2, ISize2 } from "../geography/geography.interfaces";
import { WebMercatorTileMetrics } from "..";
export declare class MapLayer<T> {
    name: string;
    directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>;
    static ValidateTileKeys(lat: number, lon: number, lod: number, width: number, height: number, metrics: WebMercatorTileMetrics): number[];
    _enabled: boolean;
    _cache?: Array<number>;
    constructor(name: string, directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>);
    get metrics(): WebMercatorTileMetrics;
}
export declare class WebMercatorMap2<T> {
    _metrics: WebMercatorTileMetrics;
    _center: IGeo2;
    _size: ISize2;
    _levelOfDetail: number;
    _layers: Map<string, MapLayer<T>>;
    _valid: boolean;
    constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: WebMercatorTileMetrics);
    get levelOfDetail(): number;
    get width(): number;
    get height(): number;
    get lat(): number;
    get lon(): number;
    zoom(v?: number): WebMercatorMap2<T>;
    resize(width: number, height: number): WebMercatorMap2<T>;
    center(lat?: number, lon?: number): WebMercatorMap2<T>;
    setEnabledLayer(v: boolean, ...names: string[]): WebMercatorMap2<T>;
    layers(predicate: (l: MapLayer<T>) => boolean): IterableIterator<MapLayer<T>>;
    addLayer(name: string, directory: ITileDirectory<T, ITileAddress, WebMercatorTileMetrics>, enabled?: boolean): WebMercatorMap2<T>;
    removeLayer(name: string): WebMercatorMap2<T>;
    invalidate(): WebMercatorMap2<T>;
    validate(): WebMercatorMap2<T>;
    private _setEnabledLayer;
}
