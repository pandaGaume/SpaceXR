import { ICompoundTile, ITile, ITileAddress, ITileBuilder, ITileMetrics, TileContentType } from "./tiles.interfaces";
export declare class TileBuilder<T> implements ITileBuilder<T> {
    static SharedBuilder<T>(): ITileBuilder<T>;
    _ns?: string;
    _a?: ITileAddress;
    _d?: TileContentType<T>;
    _m?: ITileMetrics;
    _t?: new (...args: any[]) => ITile<T>;
    _c?: Array<ITile<T>>;
    withNamespace(namesapce: string): ITileBuilder<T>;
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: TileContentType<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    withType(type: new (...args: any[]) => ITile<T>): ITileBuilder<T>;
    withChildren(...children: Array<ITile<T>>): ITileBuilder<T>;
    whithEmptyChildren(): ITileBuilder<T>;
    build(): ITile<T> | ICompoundTile<T>;
}
