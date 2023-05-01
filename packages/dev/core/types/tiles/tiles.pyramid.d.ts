import { ITileAddress, ITileDatasource, ITileDirectory, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { Tile } from "./tiles";
export type LOOKUP_RESULT<V> = V | Array<Nullable<V>> | undefined;
declare class TilePyramidNode<V extends object> extends Tile<WeakRef<V | Array<Nullable<V>>>> {
    _parent?: TilePyramidNode<V>;
    _childrens?: Array<TilePyramidNode<V>>;
    constructor(x: number, y: number, z: number, owner: TilePyramid<V>, parent?: TilePyramidNode<V>);
}
declare class TilePyramidInfos {
    depth: number;
    tileCount: number;
    constructor(depth?: number, tileCount?: number);
}
export declare class TilePyramid<V extends object> implements ITileDirectory<V, ITileAddress, ITileMetrics> {
    metrics: ITileMetrics;
    datasources: ITileDatasource<V, ITileAddress> | Array<ITileDatasource<V, ITileAddress>>;
    _root: TilePyramidNode<V>;
    _infos: TilePyramidInfos;
    constructor(metrics: ITileMetrics, datasources: ITileDatasource<V, ITileAddress> | Array<ITileDatasource<V, ITileAddress>>);
    get depth(): number;
    get tileCount(): number;
    lookupAsync(x: number, y: number, levelOfDetail: number): Promise<LOOKUP_RESULT<V>>;
    private lookup;
}
export {};
