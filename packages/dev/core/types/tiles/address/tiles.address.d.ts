import { Nullable } from "../../types";
import { ITileAddress, ITileMetrics } from "../tiles.interfaces";
export declare class TileAddress implements ITileAddress {
    static IsEquals(a: ITileAddress, b: ITileAddress): boolean;
    static IsValidAddress(a: ITileAddress, metrics: ITileMetrics): boolean;
    static AssertValidAddress(a: ITileAddress, metrics: ITileMetrics): void;
    static IsValidLod(lod: number, metrics: ITileMetrics): boolean;
    static ClampLod(levelOfDetail: number, metrics: ITileMetrics): number;
    static ToParentKey(key: string): string;
    static ToChildsKey(key: string): string[];
    static ToNeigborsKey(key: string): Nullable<string>[];
    static ToNeigborsXY(a: ITileAddress): Nullable<ITileAddress>[];
    static TileXYToQuadKey(x: number, y: number, levelOfDetail: number): string;
    static QuadKeyToTileXY(quadKey: string): ITileAddress;
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
    clone(): ITileAddress;
    toString(): string;
}
