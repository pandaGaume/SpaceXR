import { TileMapView, UpdateEventArgs } from "../tiles/tile.mapview";
import { ITile, ITileAddress, ITileDatasource, ITileMapApi, ITileMetrics, ITileMetricsProvider } from "../tiles/tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ICartesian2, ISize2 } from "../geometry/geometry.interfaces";
export interface IMapDisplay {
    resolution: ISize2;
}
export declare abstract class AbstractDisplayMap<T, D extends IMapDisplay> implements ITileMetricsProvider, ITileMapApi {
    _display: D;
    _view: TileMapView<T>;
    _activ: Map<string, ITile<T>>;
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    constructor(display: D, datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    invalidateSize(w: number, h: number): ITileMapApi;
    setView(center: IGeo2, zoom?: number | undefined): ITileMapApi;
    setZoom(zoom: number): ITileMapApi;
    zoomIn(delta: number): ITileMapApi;
    zoomOut(delta: number): ITileMapApi;
    translate(tx: number, ty: number): ITileMapApi;
    get view(): TileMapView<T>;
    get metrics(): ITileMetrics;
    protected onUpdate(args: UpdateEventArgs<T>): void;
    protected onUpdateTiles(args: UpdateEventArgs<T>): void;
    protected onUpdateView(args: UpdateEventArgs<T>): void;
    private processRemoved;
    private processAdded;
    protected abstract onDeleted(key: string, tile: ITile<T>): void;
    protected abstract onAdded(key: string, tile: ITile<T>): void;
    protected abstract invalidateDisplay(): void;
    protected abstract invalidateTiles(added: ITile<T>[] | undefined, removed: ITile<T>[] | undefined): void;
}
