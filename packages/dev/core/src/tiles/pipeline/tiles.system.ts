import { ITileContentProvider, ITileSystem } from "./tiles.pipeline.interfaces";
import { ITileAddressProcessor, ITileBuilder, ITileMetrics } from "../tiles.interfaces";

export interface ITileSystemOptions<T> {
    metrics: ITileMetrics;
    addressProcessor?: ITileAddressProcessor | undefined;
    provider: ITileContentProvider<T>;
    factory: ITileBuilder<T>;
}

export class TileSystem<T> implements ITileSystem<T> {
    _name: string;
    _metrics: ITileMetrics;
    _addressProcessor?: ITileAddressProcessor | undefined;
    _provider: ITileContentProvider<T>;
    _factory: ITileBuilder<T>;

    public constructor(name: string, options: ITileSystemOptions<T>) {
        this._name = name;
        this._metrics = options.metrics;
        this._addressProcessor = options.addressProcessor;
        this._provider = options.provider;
        this._factory = options.factory;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get name(): string {
        return this._name;
    }

    public get provider(): ITileContentProvider<T> {
        return this._provider;
    }

    public get factory(): ITileBuilder<T> {
        return this._factory;
    }

    public get addressProcessor(): ITileAddressProcessor | undefined {
        return this._addressProcessor;
    }
}
