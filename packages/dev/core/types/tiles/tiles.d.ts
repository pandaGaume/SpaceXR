import { IEnvelope } from "../geography";
import { ITile, ITileAddress, ITileMetrics, TileContentType } from "./tiles.interfaces";
import { IBounds2 } from "../geometry/geometry.interfaces";
import { TileAddress } from "./address/tiles.address";
export declare class Tile<T> extends TileAddress implements ITile<T> {
    static BuildEnvelope(t: ITile<unknown>, metrics?: ITileMetrics): IEnvelope | undefined;
    static BuildBounds(t: ITile<unknown>, metrics?: ITileMetrics): IBounds2 | undefined;
    private _value;
    private _env?;
    private _rect?;
    private _ns?;
    constructor(x: number, y: number, levelOfDetail: number, data?: TileContentType<T>, metrics?: ITileMetrics);
    get namespace(): string;
    set namespace(v: string);
    get address(): ITileAddress;
    get content(): TileContentType<T>;
    set content(v: TileContentType<T>);
    get geoBounds(): IEnvelope | undefined;
    set geoBounds(e: IEnvelope | undefined);
    get bounds(): IBounds2 | undefined;
    set bounds(r: IBounds2 | undefined);
}
