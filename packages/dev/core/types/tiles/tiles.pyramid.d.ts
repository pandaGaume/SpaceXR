import { Observable } from "core/events/events.observable";
import { ITile, ITileAddress } from "./tiles.interfaces";
declare class TilePyramidNode<V, T extends ITile<V>> {
    owner: TilePyramid<V, T>;
    parent: TilePyramidNode<V, T>;
    v?: T;
    childrens?: TilePyramidNode<V, T>[];
    constructor(owner: TilePyramid<V, T>, parent: TilePyramidNode<V, T>);
    fold(id: ITileAddress, keys: Array<number>, level: number): void;
    unfold(id: ITileAddress, keys: Array<number>, level: number): void;
    lookup(id: ITileAddress, keys: Array<number>, level: number): TilePyramidNode<V, T> | undefined;
}
export declare class TilePyramidOptions {
    static Shared: TilePyramidOptions;
    maxDepth?: number;
}
export declare class TilePyramidOptionsBuilder {
    _maxDepth?: number;
    withMaxDepth(depth: number): TilePyramidOptionsBuilder;
    build(): TilePyramidOptions;
}
export declare class TilePyramid<V, T extends ITile<V>> {
    static TileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): number[];
    _o: TilePyramidOptions;
    _root?: TilePyramidNode<V, T>;
    _tilesObservable?: Observable<T>;
    constructor(options: TilePyramidOptions);
    get tilesObservable(): Observable<T>;
    get maxDepth(): number;
    lookup(id: ITileAddress): T | undefined;
    unfold(id: ITileAddress): void;
    fold(id: ITileAddress): void;
    private lookup0;
}
export {};
