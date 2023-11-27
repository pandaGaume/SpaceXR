import { IEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileContentView, ITileMetrics, TileContent, TileSection } from "./tiles.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { TileAddress } from "./tiles.address";
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
    private static BuildEnvelope;
    private static BuildBounds;
    private _value?;
    private _env?;
    private _rect?;
    private _metrics;
    constructor(x: number, y: number, levelOfDetail: number, metrics: ITileMetrics, data?: TileContent<T>);
    get metrics(): ITileMetrics;
    get address(): ITileAddress;
    get key(): string;
    get content(): TileContent<T> | undefined;
    set content(v: TileContent<T> | undefined);
    get bounds(): IEnvelope | undefined;
    get rect(): IRectangle | undefined;
}
