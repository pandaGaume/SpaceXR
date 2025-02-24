import { Nullable } from "../../types";
import { ITileAddress2, ITileMetrics } from "../tiles.interfaces";
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
export declare class TileAddress implements ITileAddress2 {
    static Split(a: ITileAddress2, metrics: ITileMetrics): Nullable<ITileAddress2[]>;
    static ShiftMultiple(addresses: ITileAddress2[], N: number, metrics: ITileMetrics): ITileAddress2[];
    static Shift(a: ITileAddress2 | ITileAddress2[], N: number, metrics: ITileMetrics): Nullable<ITileAddress2 | ITileAddress2[]>;
    static ToBounds(a: ITileAddress2, metrics: ITileMetrics): IBounds;
    static IsEquals(a: ITileAddress2, b: ITileAddress2): boolean;
    static IsValidAddress(a: ITileAddress2, metrics: ITileMetrics): boolean;
    static AssertValidAddress(a: ITileAddress2, metrics: ITileMetrics): void;
    static IsValidLod(lod: number, metrics: ITileMetrics): boolean;
    static ClampLod(levelOfDetail: number, metrics: ITileMetrics): number;
    static ToParentKey(key: string): string;
    static ToChildsKey(key: string): string[];
    static ToNeighborsKey(key: string): Nullable<string>[];
    static ToNeighborsXY(a: ITileAddress2): Nullable<ITileAddress2>[];
    static TileXYToQuadKey(x: number, y: number, levelOfDetail: number): string;
    static QuadKeyToTileXY(quadKey: string): ITileAddress2;
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
    clone(): ITileAddress2;
    toString(): string;
}
