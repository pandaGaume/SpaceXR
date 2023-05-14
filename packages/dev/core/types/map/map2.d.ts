import { TileMapView2, UpdateEventArgs } from "../tiles/tile.mapview";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics, ITileMetricsProvider } from "../tiles/tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { IDisplay } from "./map";
import { ICartesian2 } from "../geometry/geometry.interfaces";
export declare abstract class AbstractDisplayMap<T, D extends IDisplay> implements ITileMetricsProvider {
    _display: D;
    _view: TileMapView2<T>;
    _activ: Map<string, ITile<T>>;
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    constructor(display: D, datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    get view(): TileMapView2<T>;
    get metrics(): ITileMetrics;
    protected onUpdate(args: UpdateEventArgs<T>): void;
    protected onUpdateTiles(args: UpdateEventArgs<T>): void;
    protected onUpdateView(args: UpdateEventArgs<T>): void;
    private processRemoved;
    private processAdded;
    abstract onDeleted(key: string, tile: ITile<T>): void;
    abstract onAdded(key: string, tile: ITile<T>): void;
    abstract invalidateDisplay(): void;
    abstract invalidateTiles(added: ITile<T>[] | undefined, removed: ITile<T>[] | undefined): void;
}
