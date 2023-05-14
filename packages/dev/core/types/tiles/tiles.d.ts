import { IEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileBuilder, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { IRectangle } from "../geometry/geometry.interfaces";
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
    static BuildEnvelope(a: ITileAddress, metrics?: ITileMetrics): IEnvelope | undefined;
    static BuildBounds(a: ITileAddress, metrics?: ITileMetrics): IRectangle | undefined;
    private _k?;
    private _x;
    private _y;
    private _levelOfDetail;
    private _value?;
    private _env?;
    private _rect?;
    constructor(x: number, y: number, levelOfDetail: number, data?: Nullable<T>);
    get address(): ITileAddress;
    get content(): Nullable<T> | undefined;
    set content(v: Nullable<T> | undefined);
    get x(): number;
    get y(): number;
    get levelOfDetail(): number;
    get bounds(): IEnvelope | undefined;
    set bounds(e: IEnvelope | undefined);
    get rect(): IRectangle | undefined;
    set rect(r: IRectangle | undefined);
    get quadkey(): string;
}
