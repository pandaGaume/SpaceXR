import { ITile, ITileAddress, ITileBuilder, ITileMetrics, TileContent } from "./tiles.interfaces";
export declare class TileBuilder<T> implements ITileBuilder<T> {
    _ns?: string;
    _a?: ITileAddress;
    _d?: TileContent<T>;
    _m?: ITileMetrics;
    withNamespace(namesapce: string): ITileBuilder<T>;
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: TileContent<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    build(): ITile<T>;
}
