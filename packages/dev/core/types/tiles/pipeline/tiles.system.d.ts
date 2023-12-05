import { ITileContentProvider, ITileSystem } from "./tiles.pipeline.interfaces";
import { ITileAddressProcessor, ITileBuilder, ITileMetrics } from "../tiles.interfaces";
export interface ITileSystemOptions<T> {
    metrics: ITileMetrics;
    addressProcessor?: ITileAddressProcessor | undefined;
    provider: ITileContentProvider<T>;
    factory: ITileBuilder<T>;
}
export declare class TileSystem<T> implements ITileSystem<T> {
    _name: string;
    _metrics: ITileMetrics;
    _addressProcessor?: ITileAddressProcessor | undefined;
    _provider: ITileContentProvider<T>;
    _factory: ITileBuilder<T>;
    constructor(name: string, options: ITileSystemOptions<T>);
    get metrics(): ITileMetrics;
    get name(): string;
    get provider(): ITileContentProvider<T>;
    get factory(): ITileBuilder<T>;
    get addressProcessor(): ITileAddressProcessor | undefined;
}
