import { ITile, ITileAddress, ITileBuilder, ITileCollection, ITileContentProvider, ITileMetrics, ITileProvider } from "../tiles.interfaces";
import { Observable } from "../../events/events.observable";
import { IEnvelope } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { TileCollection } from "../tiles.collections";
export declare abstract class AbstractTileProvider<T> implements ITileProvider<T> {
    _updatedObservable?: Observable<ITile<T>>;
    _enabledObservable?: Observable<ITileProvider<T>>;
    _factory: ITileBuilder<T>;
    _activTiles: TileCollection<T>;
    _enabled: boolean;
    _callback: (t: ITile<T>) => void;
    constructor(factory?: ITileBuilder<T>, enabled?: boolean);
    get bounds(): IEnvelope | undefined;
    get rect(): IRectangle | undefined;
    get updatedObservable(): Observable<ITile<T>>;
    get enabledObservable(): Observable<ITileProvider<T>>;
    get enabled(): boolean;
    set enabled(v: boolean);
    get metrics(): ITileMetrics;
    get namespace(): string;
    get factory(): ITileBuilder<T>;
    dispose(): void;
    get activTiles(): ITileCollection<T>;
    activateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
    deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
    protected _onContentFetched(tile: ITile<T>): void;
    protected _buildFactory(): ITileBuilder<T>;
    abstract _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T>;
}
export declare class TileProvider<T> extends AbstractTileProvider<T> {
    _contentProvider: ITileContentProvider<T>;
    constructor(provider: ITileContentProvider<T>, factory?: ITileBuilder<T>, enabled?: boolean);
    _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T>;
}
