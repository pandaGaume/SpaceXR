import { IEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileBuilder, ITileContentView, ITileMetrics, TileContent, TileSection } from "./tiles.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { TileAddress } from "./tiles.address";
export declare class TileBuilder<T> implements ITileBuilder<T> {
    _a?: ITileAddress;
    _d?: TileContent<T>;
    _m?: ITileMetrics;
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: TileContent<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    build(): ITile<T>;
}
export declare class TileContentView implements ITileContentView {
    address: ITileAddress;
    source?: TileSection | undefined;
    target?: TileSection | undefined;
    static BuildKey(address: ITileAddress, source?: TileSection, target?: TileSection): string;
    private _key?;
    constructor(address: ITileAddress, source?: TileSection | undefined, target?: TileSection | undefined);
    get key(): string;
}
export declare class Tile<T> extends TileAddress implements ITile<T> {
    static Builder<T>(): ITileBuilder<T>;
    static BuildEnvelope(a: ITileAddress, metrics?: ITileMetrics): IEnvelope | undefined;
    static BuildBounds(a: ITileAddress, metrics?: ITileMetrics): IRectangle | undefined;
    private _value;
    private _env?;
    private _rect?;
    constructor(x: number, y: number, levelOfDetail: number, data: TileContent<T>);
    get address(): ITileAddress;
    get key(): string;
    get content(): TileContent<T>;
    set content(v: TileContent<T>);
    get bounds(): IEnvelope | undefined;
    set bounds(e: IEnvelope | undefined);
    get rect(): IRectangle | undefined;
    set rect(r: IRectangle | undefined);
}
