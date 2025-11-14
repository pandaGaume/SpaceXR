import { ITile, ITile2DAddress, ITileBuilder, ITileMetrics, TileContentType } from "./tiles.interfaces";
export declare class TileBuilder<T> implements ITileBuilder<T> {
    static SharedBuilder<T>(): ITileBuilder<T>;
    _ns?: string;
    _a?: ITile2DAddress;
    _d?: TileContentType<T>;
    _m?: ITileMetrics;
    _t?: new (...args: any[]) => ITile<T>;
    _c?: Array<ITile<T>>;
    get metrics(): ITileMetrics;
    get namespace(): string;
    withNamespace(namespace: string): ITileBuilder<T>;
    withAddress(a: ITile2DAddress): ITileBuilder<T>;
    withData(d: TileContentType<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    withType(type: new (...args: any[]) => ITile<T>): ITileBuilder<T>;
    build(): ITile<T>;
}
