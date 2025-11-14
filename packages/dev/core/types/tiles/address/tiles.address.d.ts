import { Nullable } from "../../types";
import { ITile2DAddress, ITileMetrics } from "../tiles.interfaces";
import { IBounds } from "../../geometry";
export declare enum NeighborsIndex {
    NW = 0,
    N = 1,
    NE = 2,
    W = 3,
    C = 4,
    E = 5,
    SW = 6,
    S = 7,
    SE = 8
}
export declare class TileAddress implements ITile2DAddress {
    static Split(a: ITile2DAddress, metrics: ITileMetrics): Nullable<ITile2DAddress[]>;
    static ShiftMultiple(addresses: ITile2DAddress[], N: number, metrics: ITileMetrics): ITile2DAddress[];
    static Shift(a: ITile2DAddress | ITile2DAddress[], N: number, metrics: ITileMetrics): Nullable<ITile2DAddress | ITile2DAddress[]>;
    static ToBounds(a: ITile2DAddress, metrics: ITileMetrics): IBounds;
    static IsEquals(a: ITile2DAddress, b: ITile2DAddress): boolean;
    static IsValidAddress(a: ITile2DAddress, metrics: ITileMetrics): boolean;
    static AssertValidAddress(a: ITile2DAddress, metrics: ITileMetrics): void;
    static IsValidLod(lod: number, metrics: ITileMetrics): boolean;
    static ClampLod(levelOfDetail: number, metrics: ITileMetrics): number;
    static ToParentKey(key: string): string;
    static ToChildsKey(key: string): string[];
    static ToNeighborsKey(key: string): Nullable<string>[];
    static ToNeighborsXY(a: ITile2DAddress): Nullable<ITile2DAddress>[];
    static TileXYToQuadKey(x: number, y: number, levelOfDetail: number): string;
    static QuadKeyToTileXY(quadKey: string): ITile2DAddress;
    private _k?;
    private _x?;
    private _y?;
    private _lod?;
    constructor(x: number, y: number, levelOfDetail: number);
    get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    get levelOfDetail(): number;
    set levelOfDetail(value: number);
    get quadkey(): string;
    clone(): ITile2DAddress;
    toString(): string;
}
