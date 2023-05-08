import { ITileAddress, ITileDatasource, ITileDirectory, ITileMetrics, TileDirectoryResult } from "./tiles.interfaces";
import { Tile } from "./tiles";
declare class TilePyramidNode<V extends object> extends Tile<WeakRef<V>> {
    _parent?: TilePyramidNode<V>;
    _childrens?: Array<TilePyramidNode<V>>;
    constructor(x: number, y: number, z: number, owner: TilePyramid<V>, parent?: TilePyramidNode<V>);
}
declare class TilePyramidInfos {
    depth: number;
    tileCount: number;
    constructor(depth?: number, tileCount?: number);
}
export declare class TilePyramid<V extends object> implements ITileDirectory<V> {
    metrics: ITileMetrics;
    datasource: ITileDatasource<V, ITileAddress>;
    _root: TilePyramidNode<V>;
    _infos: TilePyramidInfos;
    constructor(metrics: ITileMetrics, datasource: ITileDatasource<V, ITileAddress>);
    get depth(): number;
    get tileCount(): number;
    lookupAsync(address: ITileAddress, args?: unknown): Promise<TileDirectoryResult<V>>;
    private _lookup;
}
export {};
