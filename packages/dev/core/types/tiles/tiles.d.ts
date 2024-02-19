import { IEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileMetrics, TileContentType } from "./tiles.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { TileAddress } from "./address/tiles.address";
export declare class Tile<T> extends TileAddress implements ITile<T> {
    static BuildEnvelope(a: ITileAddress, metrics?: ITileMetrics): IEnvelope | undefined;
    static BuildBounds(a: ITileAddress, metrics?: ITileMetrics): IRectangle | undefined;
    private _value;
    private _env?;
    private _rect?;
    private _ns?;
    constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<T>);
    get namespace(): string;
    set namespace(v: string);
    get address(): ITileAddress;
    get content(): TileContentType<T>;
    set content(v: TileContentType<T>);
    get bounds(): IEnvelope | undefined;
    set bounds(e: IEnvelope | undefined);
    get rect(): IRectangle | undefined;
    set rect(r: IRectangle | undefined);
}
