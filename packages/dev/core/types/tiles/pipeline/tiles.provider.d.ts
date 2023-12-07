import { ITileContentProvider, ITileProvider } from "./tiles.pipeline.interfaces";
import { ITile, ITileAddress, ITileAddressProcessor, ITileBuilder, ITileMetrics } from "../tiles.interfaces";
import { Observable } from "../../events/events.observable";
export declare class TileProvider<T> implements ITileProvider<T> {
    _tileUpdatedObservable?: Observable<ITile<T>>;
    _enableObservable?: Observable<ITileProvider<T>>;
    _name: string;
    _addressProcessor?: ITileAddressProcessor | undefined;
    _contentProvider: ITileContentProvider<T>;
    _factory: ITileBuilder<T>;
    _activTiles?: Map<string, ITile<T>>;
    _enabled: boolean;
    constructor(name: string, provider: ITileContentProvider<T>, factory: ITileBuilder<T>, addressProcessor?: ITileAddressProcessor, enabled?: boolean);
    get tileUpdatedObservable(): Observable<ITile<T>>;
    get enableObservable(): Observable<ITileProvider<T>>;
    get zindex(): number;
    get enabled(): boolean;
    set enabled(v: boolean);
    get metrics(): ITileMetrics;
    get name(): string;
    get contentProvider(): ITileContentProvider<T>;
    get factory(): ITileBuilder<T>;
    get addressProcessor(): ITileAddressProcessor | undefined;
    dispose(): void;
    activTiles(): IterableIterator<ITile<T>>;
    activateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
    deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
}
