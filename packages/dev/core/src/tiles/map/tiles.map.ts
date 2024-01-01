import { EventState, Observable, Observer } from "../../events/events.observable";
import { TileConsumerBase } from "../pipeline/tiles.pipeline.consumer";
import { ITilePipeline, ITilePipelineBuilder, ITileView, IsTilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITile, ITileDisplay, ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationApi, IsTileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { TileNavigation } from "../navigation";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { ITileMap, ITileMapLayer } from "./tiles.map.interfaces";
import { Nullable } from "core/types";

export class TileMapBase<T> extends TileConsumerBase<T> implements ITileMap<T> {
    _layerAddedObservable?: Observable<ITileMapLayer<T>>;
    _layerRemovedObservable?: Observable<ITileMapLayer<T>>;

    _display: ITileDisplay;
    _navigation: ITileNavigationApi;
    _pipeline: ITilePipeline<T>;
    _layers?: Map<string, ITileMapLayer<T>>;

    // internal
    _orderedLayers?: ITileMapLayer<T>[];
    _viewAddedObserver: Nullable<Observer<ITileView>>;
    _viewRemovedObserver: Nullable<Observer<ITileView>>;

    /// <summary>
    /// Create a new tile map.
    /// <param name="name">The map name.</param>
    /// <param name="display">The map display.</param>
    /// <param name="pipeline">The underlying pipeline. May be a Pipeline object or a PipelineBuilder.</param>
    /// <param name="nav">The optional navigation api. May be a NavigationAPI object or a ITileMetrics object. In the second case, it will build a new TileNavigation(metrics).
    //  If the parameter is ommited, then new TileNavigation(EPSG3857.Shared) will be used.
    //  </param>
    /// </summary>
    public constructor(name: string, display: ITileDisplay, pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>, nav?: ITileNavigationApi | ITileMetrics) {
        super(name ?? "");
        this._display = display;
        if (IsTilePipelineBuilder<T>(pipeline)) {
            pipeline = pipeline.build();
        }
        this._pipeline = pipeline;

        // as TileConsumer, link the map to the pipeline
        this._pipeline.linkTo(this);

        // build the navigation state according parameters
        nav = nav ?? new TileNavigation(EPSG3857.Shared);
        if (!IsTileNavigationState(nav)) {
            nav = new TileNavigation(nav);
        }
        this._navigation = nav;

        // link the views to the map (ie navigation state and display)
        for (const view of this._pipeline.view) {
            this._linkView(view);
        }

        // listen to view added/removed events in order to link/unlink the views to the map
        this._viewAddedObserver = this._pipeline.viewAddedObservable.add(this._onViewAdded.bind(this));
        this._viewRemovedObserver = this._pipeline.viewRemovedObservable.add(this._onViewRemoved.bind(this));
    }

    public get layerAddedObservable(): Observable<ITileMapLayer<T>> {
        if (!this._layerAddedObservable) this._layerAddedObservable = new Observable<ITileMapLayer<T>>();
        return this._layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<ITileMapLayer<T>> {
        if (!this._layerRemovedObservable) this._layerRemovedObservable = new Observable<ITileMapLayer<T>>();
        return this._layerRemovedObservable;
    }

    public get display(): ITileDisplay {
        return this._display;
    }

    public set display(display: ITileDisplay) {
        if (this._display !== display) {
            this._display = display;
            for (const view of this._pipeline.view) {
                view.display = this._display;
            }
        }
    }

    public get navigation(): ITileNavigationApi {
        return this._navigation;
    }

    public set navigation(nav: ITileNavigationApi) {
        if (this._navigation !== nav) {
            this._navigation = nav;
            for (const view of this._pipeline.view) {
                view.state = this._navigation;
            }
        }
    }

    public get pipeline(): ITilePipeline<T> {
        return this._pipeline;
    }

    public *getLayers(predicate?: ((l: ITileMapLayer<T>) => boolean) | undefined): IterableIterator<ITileMapLayer<T>> {
        if (this._layers) {
            if (predicate) {
                for (const layer of this._layers.values()) {
                    if (predicate(layer)) yield layer;
                }
            } else {
                yield* this._layers.values();
            }
        }
    }

    public addLayer(layer: ITileMapLayer<T>): void {
        if (!this._layers) this._layers = new Map<string, ITileMapLayer<T>>();
        if (layer.name && !this._layers.has(layer.name)) {
            this._layers.set(layer.name, layer);
            this._onLayerAdded(layer);
            if (this._layerAddedObservable && this._layerAddedObservable.hasObservers()) {
                this._layerAddedObservable.notifyObservers(layer, -1, this, this);
            }
        }
    }

    public removeLayer(layer: ITileMapLayer<T>): void {
        if (this._layers && layer.name && this._layers.has(layer.name)) {
            this._layers.delete(layer.name);
            this._onLayerRemoved(layer);
            if (this._layerRemovedObservable && this._layerRemovedObservable.hasObservers()) {
                this._layerRemovedObservable.notifyObservers(layer, -1, this, this);
            }
        }
    }

    public dispose() {
        super.dispose();
        // clear pipeline links
        this._viewAddedObserver?.dispose();
        this._viewRemovedObserver?.dispose();
        this._pipeline.unlinkFrom(this);
        for (const view of this._pipeline.view) {
            this._unlinkView(view);
        }
    }

    protected _onViewAdded(view: ITileView, state: EventState): void {
        this._linkView(view);
    }

    protected _onViewRemoved(view: ITileView, state: EventState): void {
        this._unlinkView(view);
    }

    protected _linkView(view: ITileView): void {
        view.display = this._display;
        view.state = this._navigation;
    }

    protected _unlinkView(view: ITileView): void {
        view.display = null;
        view.state = null;
    }

    protected _addSortedLayer(layer: ITileMapLayer<T>): void {
        if (!this._orderedLayers) this._orderedLayers = [];
        this._orderedLayers.push(layer);
        this._orderedLayers.sort((a, b) => a.zindex - b.zindex); // sort by zindex
    }

    protected _removeSortedLayer(layer: ITileMapLayer<T>): void {
        if (this._orderedLayers) {
            const index = this._orderedLayers.findIndex((l) => l === layer);
            if (index !== -1) {
                this._orderedLayers.splice(index, 1);
            }
        }
    }

    protected _onLayerAdded(layer: ITileMapLayer<T>): void {
        this._addSortedLayer(layer);
    }

    protected _onLayerRemoved(layer: ITileMapLayer<T>): void {
        this._removeSortedLayer(layer);
    }

    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): boolean {
        return super._onTileAdded(eventData, eventState);
    }
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): boolean {
        return super._onTileRemoved(eventData, eventState);
    }
    protected _onTileUpdated(eventData: Array<ITile<T>>, eventState: EventState): boolean {
        return super._onTileUpdated(eventData, eventState);
    }
}
