import { IMemoryCache } from "../../cache";
import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { TileProvider } from "../providers/tiles.provider";
import { TileContentProvider } from "../providers/tiles.provider.content";

import { ITile, ITileAddress, ITileCollection, ITileDatasource, ITileMetrics, ITileProvider, IsTileDatasource, TileContentType } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerOptions, ITileDisplay } from "./tiles.map.interfaces";
import { ITilePipeline, ITileView, TilePipelineBuilder, TileProducer, TileView } from "../pipeline";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
import { AbstractTileMapLayer } from "./tiles.map.layer.abstract";

export class TileMapLayer<T> extends AbstractTileMapLayer<T> implements ITileMapLayer<T> {
    protected _pipeline: ITilePipeline<T>;
    _pipelinePropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>>;
    _provider: ITileProvider<T>;

    public constructor(name: string, provider: ITileProvider<T> | ITileDatasource<T, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean) {
        super(name, options, enabled);
        if (!provider) throw new Error("Invalid provider or datasource");

        this._provider = IsTileDatasource<T, ITileAddress>(provider) ? this._buildProvider(provider) : provider;
        this._pipeline = this._buildPipeline(this._provider);
        this._pipelinePropertyObserver = this._pipeline.propertyChangedObservable.add(this._onPipelinePropertyChanged.bind(this));

        // as TileConsumer, link the map to the pipeline
        this._pipeline.producer.linkTo(this);
    }

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, metrics?: ITileMetrics, dispatchEvent: boolean = true): void {
        super.setContext(state, display, metrics, dispatchEvent);
        this._pipeline.view?.setContext(this._state, display, metrics ?? this.metrics, dispatchEvent);
    }

    public get metrics(): ITileMetrics {
        return this._provider.metrics;
    }

    public dispose() {
        super.dispose();
        // clear pipeline links
        this._pipelinePropertyObserver?.disconnect();
        this._pipeline.view?.dispose();
        this._pipeline.producer?.dispose();
    }

    public get activTiles(): ITileCollection<T> {
        return this._provider.activTiles;
    }

    protected _buildProvider(
        provider: ITileDatasource<T, ITileAddress>,
        cache?: IMemoryCache<string, TileContentType<T>>,
        type?: new (...args: any[]) => ITile<T>
    ): ITileProvider<T> {
        const contentProvider = new TileContentProvider<T>(provider, cache);
        const p = new TileProvider(contentProvider);
        if (type) p.factory.withType(type);
        return p;
    }

    protected _buildPipeline(provider: ITileProvider<T>): ITilePipeline<T> {
        const producer = new TileProducer(`${this.name}.producer`, provider);
        return new TilePipelineBuilder<T>().withView(this._buildView()).withProducer(producer).withConsumer(this).build();
    }

    protected _buildView(): ITileView {
        return new TileView(`${this.name}.view`);
    }

    protected _onPipelinePropertyChanged(event: PropertyChangedEventArgs<ITilePipeline<T>, unknown>, state: EventState): void {
        // nothing to do - keep for debug
    }
}
