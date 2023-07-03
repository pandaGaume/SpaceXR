import { ICartesian2, ISize2 } from "../geometry/geometry.interfaces";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
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
export declare class UpdateEventArgs<T> extends EventArgs<TileMapView<T>> {
    _reason: UpdateReason;
    _added?: Array<ITile<T>>;
    _removed?: Array<ITile<T>>;
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    constructor(source: TileMapView<T>, reason: UpdateReason, lod: number, scale: number, center: ICartesian2, added?: Array<ITile<T>>, removed?: Array<ITile<T>>);
    get reason(): UpdateReason;
    get added(): Array<ITile<T>> | undefined;
    get removed(): Array<ITile<T>> | undefined;
    get lod(): number;
    get scale(): number;
    get center(): ICartesian2;
}
export declare class TileMapView<T> implements ITileMapApi, ISize2, ITileMetricsProvider, IValidable<TileMapView<T>>, IGeoBounded {
    static ClampAzimuth(a: number): number;
    _cache: IMemoryCache<string, ITile<T>>;
    _datasource: ITileDatasource<T, ITileAddress>;
    _w: number;
    _h: number;
    _lod: number;
    _bounds?: IEnvelope;
    _center: IGeo2;
    _level: TileMapLevel<T>;
    _azimuth: number;
    _cosangle: number;
    _sinangle: number;
    _valid: boolean;
    _cartesianCache: ICartesian2;
    _resizeObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, number>>;
    _updateObservable?: Observable<UpdateEventArgs<T>>;
    constructor(datasource: ITileDatasource<T, ITileAddress>, width: number, height: number, center: IGeo2, lod: number, cache?: IMemoryCache<string, ITile<T>>);
    get resizeObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>>;
    get centerObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>;
    get zoomObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, number>>;
    get updateObservable(): Observable<UpdateEventArgs<T>>;
    get bounds(): IEnvelope | undefined;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get level(): TileMapLevel<T>;
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
    private onResizeObserverAdded;
    private onZoomObserverAdded;
    private onCenterObserverAdded;
    private onUpdateObserverAdded;
    protected doValidate(): void;
    protected doValidateLevel(level: TileMapLevel<T>): void;
    private onTileReady;
    protected onTileNotFound(t: ITile<T>): void;
    private rotatePointsArround;
    private rotatePointInv;
    private rotatePointArround;
    private getRectangle;
}
