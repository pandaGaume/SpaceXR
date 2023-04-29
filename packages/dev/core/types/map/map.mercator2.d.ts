import { ITileAddress, ITileDatasource, ITileMapMetrics } from "../tiles/tiles.interfaces";
import { IEnvelope, IGeo2, IGeoBounded, ISize2 } from "../geography/geography.interfaces";
export declare class MapLayer<T> {
    name: string;
    tileDataSource: ITileDatasource<T, ITileAddress>;
    _enabled: boolean;
    constructor(name: string, tileDataSource: ITileDatasource<T, ITileAddress>);
    get enabled(): boolean;
}
export declare class WebMercatorMap2<T> implements IGeoBounded {
    _metrics: ITileMapMetrics;
    _center: IGeo2;
    _size: ISize2;
    _levelOfDetail: number;
    _layers?: Map<string, MapLayer<T>>;
    _defaultLayer?: string;
    _env?: IEnvelope;
    constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: ITileMapMetrics);
    get levelOfDetail(): number;
    get width(): number;
    get height(): number;
    get lat(): number;
    get lon(): number;
    get bounds(): IEnvelope | undefined;
    zoom(v?: number): WebMercatorMap2<T>;
    resize(width: number, height: number): WebMercatorMap2<T>;
    center(lat?: number, lon?: number): WebMercatorMap2<T>;
    layers(): IterableIterator<T>;
    addLayer(name: string, tileDataSource: ITileDatasource<T, ITileAddress>): WebMercatorMap2<T>;
    removeLayer(name: string): void;
    invalidate(): WebMercatorMap2<T>;
    validate(): WebMercatorMap2<T>;
    private buildEnvelope;
    private validateTileKeys;
}
