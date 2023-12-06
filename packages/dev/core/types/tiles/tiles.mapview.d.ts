import { ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsProvider, ITile } from "./tiles.interfaces";
import { ITileContentProvider, ContentUpdateEventArgs } from "./pipeline/tiles.interfaces.pipeline";
import { ITileMapApi } from "./api/tiles.interfaces.api";
import { Observable } from "../events/events.observable";
import { IValidable, Nullable } from "../types";
import { EventArgs, PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache } from "../utils/cache";
export interface IContextMetrics {
    lod: number;
    scale: number;
    center: ICartesian2;
}
export declare class TileMapContext<T> implements IContextMetrics {
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    _tiles: Map<string, ITile<T>>;
    _rect: IRectangle;
    constructor(lod?: number);
    get lod(): number;
    get scale(): number;
    get tiles(): Map<string, ITile<T>>;
    get size(): number;
    get center(): ICartesian2;
    get rect(): IRectangle;
    clear(): void;
}
export declare enum UpdateReason {
    viewChanged = 0,
    tileReady = 1
}
export declare class UpdateEventArgs<T> extends EventArgs<TileMapView<T>> {
    _reason: UpdateReason;
    _added?: Array<ITile<T>>;
    _removed?: Array<ITile<T>>;
    _previousInfos?: IContextMetrics;
    _infos: IContextMetrics;
    constructor(source: TileMapView<T>, reason: UpdateReason, infos: IContextMetrics, oldInfos?: IContextMetrics, added?: Array<ITile<T>>, removed?: Array<ITile<T>>);
    get reason(): UpdateReason;
    get added(): Array<ITile<T>> | undefined;
    get removed(): Array<ITile<T>> | undefined;
    get infos(): IContextMetrics;
    get previousInfos(): IContextMetrics | undefined;
    get lod(): number;
    get scale(): number;
    get center(): ICartesian2;
}
export declare class TileMapView<T> implements ITileMapApi, ISize2, ITileMetricsProvider, IValidable<TileMapView<T>>, IGeoBounded {
    addedObservable: any;
    removedObservable: any;
    static ClampAzimuth(a: number): number;
    _cache: IMemoryCache<string, ITile<T>>;
    _contentProvider: ITileContentProvider<T>;
    _w: number;
    _h: number;
    _lodf: number;
    _lod: number;
    _bounds?: IEnvelope;
    _center: IGeo2;
    _contexts: Array<TileMapContext<T>>;
    _currentContext: TileMapContext<T>;
    _cacheUpperLOD: boolean;
    _cacheLowerLOD: boolean;
    _azimuth: number;
    _cosangle: number;
    _sinangle: number;
    _valid: boolean;
    _cartesianCache: ICartesian2;
    _resizeObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    _azimuthObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    _updateObservable?: Observable<UpdateEventArgs<T>>;
    _viewChangedObservable?: Observable<ITileMapApi>;
    constructor(contentProvider: ITileContentProvider<T>, width: number, height: number, center: IGeo2, lod: number, cache?: IMemoryCache<string, ITile<T>>);
    get resizeObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>;
    get centerObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>;
    get zoomObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    get azimuthObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    get updateObservable(): Observable<UpdateEventArgs<T>>;
    get viewChangedObservable(): Observable<ITileMapApi>;
    get zoom(): number;
    get scale(): number;
    get centerXY(): ICartesian2;
    get boundsXY(): IRectangle;
    get bounds(): IEnvelope | undefined;
    get contentProvider(): ITileContentProvider<T>;
    get context(): TileMapContext<T>;
    get levelOfDetail(): number;
    get center(): IGeo2;
    get azimuth(): number;
    get metrics(): ITileMetrics;
    get width(): number;
    get height(): number;
    invalidateSize(w: number, h: number): ITileMapApi;
    setView(center: IGeo2, zoom?: number, azimuth?: number): ITileMapApi;
    setZoom(zoom: number): ITileMapApi;
    setAzimuth(r: number): ITileMapApi;
    zoomIn(delta: number): ITileMapApi;
    zoomOut(delta: number): ITileMapApi;
    translate(tx: number, ty: number): ITileMapApi;
    rotate(r: number): ITileMapApi;
    validateBounds(): IEnvelope | undefined;
    get isValid(): boolean;
    invalidate(): TileMapView<T>;
    validate(): TileMapView<T>;
    revalidate(): TileMapView<T>;
    private _getContext;
    private onResizeObserverAdded;
    private onZoomObserverAdded;
    private onCenterObserverAdded;
    private onAzimuthObserverAdded;
    private onUpdateObserverAdded;
    protected doValidate(): void;
    protected doValidateWithCache(): void;
    protected doClearContext(oldLevel: TileMapContext<T>, newLevel: TileMapContext<T>): void;
    protected doValidateContext(oldLevel: TileMapContext<T>, newLevel: Nullable<TileMapContext<T>>, dispatchEvent?: boolean): void;
    protected onTileContentUpdate(args: ContentUpdateEventArgs<T>): void;
    private onTileReady;
    protected onTileNotFound(t: ITile<T>): void;
    private rotatePointsArround;
    private rotatePointInv;
    private rotatePointArround;
    private getRectangle;
}
