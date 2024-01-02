import { ITileAddressProcessor, ITileBuilder, ITileContentProvider, ITileContentProviderBuilder, ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
export declare class TileProviderBuilder<T> implements ITileProviderBuilder<T> {
    _enabled?: boolean;
    _factory?: ITileBuilder<T>;
    _addressProcessor?: ITileAddressProcessor;
    _contentProvider?: ITileContentProvider<T> | ITileContentProviderBuilder<T>;
    withEnabled(enabled: boolean): ITileProviderBuilder<T>;
    withFactory(factory: ITileBuilder<T>): ITileProviderBuilder<T>;
    withAddressProcessor(processor: ITileAddressProcessor): ITileProviderBuilder<T>;
    withContentProvider(contentProvider: ITileContentProvider<T> | ITileContentProviderBuilder<T>): ITileProviderBuilder<T>;
    build(): ITileProvider<T>;
}
