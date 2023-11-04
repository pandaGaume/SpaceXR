import { Nullable } from "../types";
import { ICartesian3 } from "../geometry/geometry.interfaces";
import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
export declare class TileAddress implements ITileAddress {
    x: number;
    y: number;
    levelOfDetail: number;
    static IsValidAddress(a: ITileAddress, metrics: ITileMetrics): boolean;
    static AssertValidAddress(a: ITileAddress, metrics: ITileMetrics): void;
    static IsValidLod(lod: number, metrics: ITileMetrics): boolean;
    static ClampLod(levelOfDetail: number, metrics: ITileMetrics): number;
    static GetLodScale(lod: number): number;
    static ToParentKey(key: string): string;
    static ToNormalizedSection(key: string): Nullable<ICartesian3>;
    static ToChildsKey(key: string): string[];
    static ToNeigborsKey(key: string): Nullable<string>[];
    static ToNeigborsXY(a: ITileAddress): Nullable<ITileAddress>[];
    static TileXYToQuadKey(a: ITileAddress): string;
    static QuadKeyToTileXY(quadKey: string): ITileAddress;
    private _k?;
    constructor(x: number, y: number, levelOfDetail: number);
    get quadkey(): string;
    toString(): string;
}
