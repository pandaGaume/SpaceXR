import { ITile, ITileAddress, ITileBuilder, ITileMetrics, TileContentType } from "./tiles.interfaces";
export declare class TileBuilder<T> implements ITileBuilder<T> {
    _ns?: string;
    _a?: ITileAddress;
    _d?: TileContentType<T>;
    _m?: ITileMetrics;
    withNamespace(namesapce: string): ITileBuilder<T>;
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: TileContentType<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    build(): ITile<T>;
}
