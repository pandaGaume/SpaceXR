import { ISize2 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsProvider, ITileDirectory, ITileMapApi, ITile } from "./tiles.interfaces";
import { Observable } from "../events/events.observable";
import { IValidable } from "../types";
import { EventArgs, PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache } from "../utils/cache";
export declare class TileMapLevel<T> {
    _lod: number;
    _tiles: Map<string, ITile<T>>;
    constructor(lod: number);
    get lod(): number;
    get tiles(): Map<string, ITile<T>>;
    get size(): number;
}
export declare class UpdateEventArgs<T> extends EventArgs<TileMapView<T>> {
    _added?: Map<string, ITile<T>>;
    _removed?: Map<string, ITile<T>>;
    constructor(source: TileMapView<T>, added?: Map<string, ITile<T>>, removed?: Map<string, ITile<T>>);
    get added(): Map<string, ITile<T>> | undefined;
    get removed(): Map<string, ITile<T>> | undefined;
}
export declare class TileMapView<T> implements ITileMapApi, ISize2, ITileMetricsProvider, IValidable<TileMapView<T>> {
    _cache: IMemoryCache<string, T>;
    _d: ITileDirectory<T>;
    _w: number;
    _h: number;
    _center: IGeo2;
    _levels: Array<TileMapLevel<T>>;
    _lod: number;
    _valid: boolean;
    _resizeObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, number>>;
    _updateObservable?: Observable<UpdateEventArgs<T>>;
    constructor(directory: ITileDirectory<T>, width: number, height: number, center: IGeo2, lod: number, cache?: IMemoryCache<string, T>);
    get resizeObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>>;
    get centerObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>;
    get zoomObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, number>>;
    get updateObservable(): Observable<UpdateEventArgs<T>>;
    get directory(): ITileDirectory<T>;
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
    invalidate(): TileMapView<T>;
    validate(): TileMapView<T>;
    revalidate(): TileMapView<T>;
    private onResizeObserverAdded;
    private onZoomObserverAdded;
    private onCenterObserverAdded;
    private onUpdateObserverAdded;
    protected doValidate(): void;
    protected doValidateLevel(lod: number): void;
}
