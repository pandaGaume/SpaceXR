import { IMemoryCache } from "../../cache";
import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { TileProvider } from "../providers/tiles.provider";
import { TileContentProvider } from "../providers/tiles.provider.content";

import { ITileAddress, ITileCollection, ITileDatasource, ITileMetrics, ITileProvider, IsTileDatasource, TileContentType } from "../tiles.interfaces";
import { ITileMap, ITileMapLayer, ITileMapLayerOptions, ITileDisplay } from "./tiles.map.interfaces";
import { ITilePipeline, ITileView, TileConsumerBase, TilePipelineBuilder, TileProducer, TileView } from "../pipeline";
import { Nullable } from "../../types";
import { ITileNavigationState, TileNavigationState } from "../navigation";

export class TileMapLayer<T> extends TileConsumerBase<T> implements ITileMapLayer<T> {
    _zindex: number;
    _alpha: number;
    _zoomOffset?: number;
    _attribution?: string;
    _enabled: boolean;

    protected _pipeline: ITilePipeline<T>;
    _pipelinePropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>>;
    _provider: ITileProvider<T>;
    _state: ITileNavigationState;

    public constructor(name: string, provider: ITileProvider<T> | ITileDatasource<T, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean) {
        super(name);
        if (!provider) throw new Error("Invalid provider or datasource");
        this._zindex = options?.zindex ?? -1;
        this._alpha = options?.alpha !== undefined ? Math.min(Math.max(options?.alpha, 0), 1.0) : 1.0; // default is opaque
        this._zoomOffset = options?.zoomOffset !== undefined ? options?.zoomOffset : 0;
        this._attribution = options?.attribution;
        this._enabled = enabled ?? true; // default is enabled

        this._provider = IsTileDatasource<T, ITileAddress>(provider) ? this._buildProvider(provider) : provider;
        this._pipeline = this._buildPipeline(this._provider);
        this._pipelinePropertyObserver = this._pipeline.propertyChangedObservable.add(this._onPipelinePropertyChanged.bind(this));

        // as TileConsumer, link the map to the pipeline
        this._pipeline.producer.linkTo(this);
        this._state = new TileNavigationState();
    }

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, metrics?: ITileMetrics, dispatchEvent: boolean = true): void {
        if (state) {
            this._state.setView(state.center, state.zoom + this.zoomOffset, state.azimuth.value).validate();
        }
        this._pipeline.view?.setContext(this._state, display, metrics ?? this.metrics, dispatchEvent);
    }

    public get metrics(): ITileMetrics {
        return this._provider.metrics;
    }

    public get zindex(): number {
        return this._zindex;
    }

    public set zindex(zindex: number) {
        if (this._zindex !== zindex) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._zindex;
                this._zindex = zindex;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._zindex, "zindex");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._zindex = zindex;
        }
    }

    public get zoomOffset(): number {
        return this._zoomOffset ?? 0;
    }

    public set zoomOffset(zoomOffset: number) {
        if (this._zoomOffset !== zoomOffset) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._zoomOffset;
                this._zoomOffset = zoomOffset;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._zoomOffset, "zoomOffset");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._zoomOffset = zoomOffset;
        }
    }

    public get attribution(): string | undefined {
        return this._attribution;
    }

    public set attribution(attribution: string | undefined) {
        if (this._attribution !== attribution) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._attribution;
                this._attribution = attribution;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._attribution, "attribution");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._attribution = attribution;
        }
    }

    public get alpha(): number {
        return this._alpha;
    }

    public set alpha(alpha: number) {
        const a = Math.min(Math.max(alpha, 0), 1.0);
        if (this._alpha !== a) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._alpha;
                this._alpha = a;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._alpha, "alpha");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._alpha = a;
        }
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(enabled: boolean) {
        if (this._enabled !== enabled) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._enabled;
                this._enabled = enabled;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._enabled, "enabled");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._enabled = enabled;
        }
    }

    public addTo(map: ITileMap<T>): ITileMapLayer<T> {
        map?.addLayer(this);
        return this;
    }

    public dispose() {
        super.dispose();
        // clear pipeline links
        this._pipelinePropertyObserver?.disconnect();
        this._pipeline.view?.dispose();
        this._pipeline.producer?.dispose();
    }

    public getActiveTiles(): Nullable<ITileCollection<T>> {
        return this._provider.activTiles;
    }

    protected _buildProvider(provider: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContentType<T>>): ITileProvider<T> {
        const contentProvider = new TileContentProvider<T>(provider, cache);
        return new TileProvider(contentProvider);
    }

    protected _buildPipeline(provider: ITileProvider<T>): ITilePipeline<T> {
        const producer = new TileProducer(`${this.name}.producer`, provider);
        return new TilePipelineBuilder<T>().withView(this._buildView()).withProducer(producer).withConsumer(this).build();
    }

    protected _buildView(): ITileView {
        return new TileView(`${this.name}.view`);
    }

    private _onPipelinePropertyChanged(event: PropertyChangedEventArgs<ITilePipeline<T>, unknown>, state: EventState): void {
        // nothing to do - keep for debug
    }
}
