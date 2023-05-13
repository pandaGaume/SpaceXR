import { IEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileBuilder, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
export declare class TileBuilder<T> implements ITileBuilder<T> {
    _a?: ITileAddress;
    _d?: Nullable<T>;
    _m?: ITileMetrics;
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: Nullable<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    build(): ITile<T>;
}
export declare class Tile<T> implements ITile<T>, ITileAddress {
    static Builder<T>(): ITileBuilder<T>;
    static BuildEnvelope(x: number, y: number, lod: number, metrics?: ITileMetrics): IEnvelope | undefined;
    private _k?;
    private _x;
    private _y;
    private _levelOfDetail;
    private _value;
    private _env?;
    constructor(x: number, y: number, levelOfDetail: number, data?: Nullable<T>, metrics?: ITileMetrics);
    get address(): ITileAddress;
    get content(): Nullable<T>;
    set content(v: Nullable<T>);
    get x(): number;
    get y(): number;
    get levelOfDetail(): number;
    get bounds(): IEnvelope | undefined;
    set bounds(e: IEnvelope | undefined);
    get quadkey(): string;
}
