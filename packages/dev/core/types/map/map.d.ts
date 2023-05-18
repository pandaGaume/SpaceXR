import { TileMapView, UpdateEventArgs } from "../tiles/tile.mapview";
import { ITile, ITileAddress, ITileDatasource, ITileMapApi, ITileMetrics, ITileMetricsProvider } from "../tiles/tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ICartesian2, ISize2 } from "../geometry/geometry.interfaces";
export interface IMapDisplay {
    resolution: ISize2;
}
export declare abstract class AbstractDisplayMap<V, T extends ITile<V>, D extends IMapDisplay> implements ITileMetricsProvider, ITileMapApi {
    _display: D;
    _view: TileMapView<V>;
    _activ: Map<string, T>;
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    constructor(display: D, datasource: ITileDatasource<V, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    invalidateSize(w: number, h: number): ITileMapApi;
    setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi;
    setZoom(zoom: number): ITileMapApi;
    setRotation(r: number): ITileMapApi;
    zoomIn(delta: number): ITileMapApi;
    zoomOut(delta: number): ITileMapApi;
    translate(tx: number, ty: number): ITileMapApi;
    rotate(r: number): ITileMapApi;
    get display(): D;
    get view(): TileMapView<V>;
    get metrics(): ITileMetrics;
    protected onUpdate(args: UpdateEventArgs<V>): void;
    protected onUpdateTiles(args: UpdateEventArgs<V>): void;
    protected onUpdateView(args: UpdateEventArgs<V>): void;
    private processRemoved;
    private processAdded;
    protected buildMapTile(t: ITile<V>): T;
    protected abstract onDeleted(key: string, tile: T): void;
    protected abstract onAdded(key: string, tile: T): void;
    protected abstract invalidateDisplay(): void;
    protected abstract invalidateTiles(added: Array<T> | undefined, removed: Array<ITile<V>> | undefined): void;
}
