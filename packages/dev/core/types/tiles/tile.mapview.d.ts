import { ICartesian2, ISize2 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsProvider, ITileMapApi, ITile, ITileDatasource, ITileAddress } from "./tiles.interfaces";
import { Observable } from "../events/events.observable";
import { IValidable } from "../types";
import { EventArgs, PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache } from "../utils/cache";
export declare class TileMapLevel<T> {
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    _tiles: Map<string, ITile<T>>;
    get lod(): number;
    get scale(): number;
    get tiles(): Map<string, ITile<T>>;
    get size(): number;
    get center(): ICartesian2;
}
export declare enum UpdateReason {
    viewChanged = 0,
    tileReady = 1
}
export declare class UpdateEventArgs<T> extends EventArgs<TileMapView2<T>> {
    _reason: UpdateReason;
    _added?: Array<ITile<T>>;
    _removed?: Array<ITile<T>>;
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    constructor(source: TileMapView2<T>, reason: UpdateReason, lod: number, scale: number, center: ICartesian2, added?: Array<ITile<T>>, removed?: Array<ITile<T>>);
    get reason(): UpdateReason;
    get added(): Array<ITile<T>> | undefined;
    get removed(): Array<ITile<T>> | undefined;
    get lod(): number;
    get scale(): number;
    get center(): ICartesian2;
}
export declare class TileMapView2<T> implements ITileMapApi, ISize2, ITileMetricsProvider, IValidable<TileMapView2<T>> {
    _cache: IMemoryCache<string, ITile<T>>;
    _datasource: ITileDatasource<T, ITileAddress>;
    _metrics: ITileMetrics;
    _w: number;
    _h: number;
    _lod: number;
    _center: IGeo2;
    _level: TileMapLevel<T>;
    _valid: boolean;
    _resizeObservable?: Observable<PropertyChangedEventArgs<TileMapView2<T>, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<TileMapView2<T>, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<TileMapView2<T>, number>>;
    _updateObservable?: Observable<UpdateEventArgs<T>>;
    constructor(datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, width: number, height: number, center: IGeo2, lod: number, cache?: IMemoryCache<string, ITile<T>>);
    get resizeObservable(): Observable<PropertyChangedEventArgs<TileMapView2<T>, ISize2>>;
    get centerObservable(): Observable<PropertyChangedEventArgs<TileMapView2<T>, IGeo2>>;
    get zoomObservable(): Observable<PropertyChangedEventArgs<TileMapView2<T>, number>>;
    get updateObservable(): Observable<UpdateEventArgs<T>>;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get level(): TileMapLevel<T>;
    get levelOfDetail(): number;
    get center(): IGeo2;
    get metrics(): ITileMetrics;
    get width(): number;
    get height(): number;
    invalidateSize(w: number, h: number): ITileMapApi;
    setView(center: IGeo2, zoom?: number): ITileMapApi;
    setZoom(zoom: number): ITileMapApi;
    zoomIn(delta: number): ITileMapApi;
    zoomOut(delta: number): ITileMapApi;
    translate(tx: number, ty: number): ITileMapApi;
    get isValid(): boolean;
    invalidate(): TileMapView2<T>;
    validate(): TileMapView2<T>;
    revalidate(): TileMapView2<T>;
    private onResizeObserverAdded;
    private onZoomObserverAdded;
    private onCenterObserverAdded;
    private onUpdateObserverAdded;
    protected doValidate(): void;
    protected doValidateLevel(level: TileMapLevel<T>): void;
    private onTileReady;
    protected onTileNotFound(t: ITile<T>): void;
}
