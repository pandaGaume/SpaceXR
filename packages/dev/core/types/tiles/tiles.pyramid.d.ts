import { Observable } from "core/events/events.observable";
import { ITile, ITileAddress, ITileClient, ITileDirectory, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "core/types";
export type DATA_CONTAINER<V> = Array<Nullable<V>>;
declare class TilePyramidNode<V> implements ITile<DATA_CONTAINER<V>>, ITileAddress {
    _owner: TilePyramid<V>;
    _parent?: TilePyramidNode<V>;
    _childrens?: Array<TilePyramidNode<V>>;
    _x: number;
    _y: number;
    _z: number;
    _value?: WeakRef<DATA_CONTAINER<V>>;
    constructor(x: number, y: number, z: number, owner: TilePyramid<V>, parent?: TilePyramidNode<V>);
    get address(): ITileAddress | undefined;
    get data(): DATA_CONTAINER<V> | undefined;
    get x(): number;
    get y(): number;
    get levelOfDetail(): number;
}
export declare class TilePyramid<V> implements ITileDirectory<V, ITileAddress> {
    metrics: ITileMetrics;
    client: Array<ITileClient<V, ITileAddress>>;
    _root: TilePyramidNode<V>;
    _tilesObservable?: Observable<ITile<DATA_CONTAINER<V>>>;
    constructor(metrics: ITileMetrics, client: Array<ITileClient<V, ITileAddress>>);
    get tilesObservable(): Observable<ITile<DATA_CONTAINER<V>>>;
    get maxDepth(): number;
    lookupAsync(key: ITileAddress): Promise<DATA_CONTAINER<V> | undefined>;
    private lookup;
}
export {};
