import { EventState, Observable, Observer } from "../../events/events.observable";
import { TileConsumerBase } from "../pipeline/tiles.pipeline.consumer";
import { ITilePipeline, ITilePipelineBuilder, ITileView, IsTilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplay, ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationApi, IsTileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { TileNavigation } from "../navigation";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { ITileMap, ITileMapLayer } from "./tiles.map.interfaces";
import { Nullable } from "../../types";
import { PropertyChangedEventArgs } from "../../events/events.args";

export class TileMapBase<T> extends TileConsumerBase<T> implements ITileMap<T> {
    _layerAddedObservable?: Observable<ITileMapLayer<T>>;
    _layerRemovedObservable?: Observable<ITileMapLayer<T>>;

    protected _display: Nullable<ITileDisplay>;
    protected _navigation: ITileNavigationApi;
    protected _pipeline: ITilePipeline<T>;
    protected _layers?: Map<string, ITileMapLayer<T>>;

    // internal
    protected _orderedLayers?: ITileMapLayer<T>[];

    _viewAddedObserver: Nullable<Observer<ITileView>>;
    _viewRemovedObserver: Nullable<Observer<ITileView>>;

    _displayPropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileDisplay, unknown>>>;

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
            this._bindView(view);
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

    public get display(): Nullable<ITileDisplay> {
        return this._display;
    }

    public set display(display: Nullable<ITileDisplay>) {
        if (this._display !== display) {
            if (this._display) {
                this._unbindDisplay(this._display);
            }
            this._display = display;
            if (this._display) {
                this._bindDisplay(this._display);
            }
            this.invalidate();
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
            this.invalidate();
        }
    }

    public get pipeline(): ITilePipeline<T> {
        return this._pipeline;
    }

    public *getLayers(predicate?: (l: ITileMapLayer<T>) => boolean, sorted: boolean = true): IterableIterator<ITileMapLayer<T>> {
        if (sorted) return this.getOrderedLayers(predicate);

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

    public *getOrderedLayers(predicate?: (l: ITileMapLayer<T>) => boolean): IterableIterator<ITileMapLayer<T>> {
        if (this._orderedLayers) {
            if (predicate) {
                for (const layer of this._orderedLayers ?? []) {
                    if (predicate(layer)) yield layer;
                }
            } else {
                yield* this._orderedLayers ?? [];
            }
        }
    }

    public addLayer(layer: ITileMapLayer<T>): void {
        if (!this._layers) this._layers = new Map<string, ITileMapLayer<T>>();
        if (layer.name && !this._layers.has(layer.name)) {
            this._layers.set(layer.name, layer);
            this._addSortedLayer(layer);
            this.invalidate();
            // we give the hand to other components
            this._onLayerAdded(layer);
            if (this._layerAddedObservable && this._layerAddedObservable.hasObservers()) {
                this._layerAddedObservable.notifyObservers(layer, -1, this, this);
            }
        }
    }

    public removeLayer(layer: ITileMapLayer<T>): void {
        if (this._layers && layer.name && this._layers.has(layer.name)) {
            this._layers.delete(layer.name);
            this._removeSortedLayer(layer);
            this.invalidate();
            // we give the hand to other components
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
            this._unbindView(view);
        }
        if (this._display) {
            this._unbindDisplay(this._display);
        }
    }

    private _onViewAdded(view: ITileView, state: EventState): void {
        this._bindView(view);
    }

    private _onViewRemoved(view: ITileView, state: EventState): void {
        this._unbindView(view);
    }

    private _bindView(view: ITileView): void {
        view.display = this._display;
        view.state = this._navigation;
        this.invalidate();
        this._onViewBinded(view);
    }

    private _unbindView(view: ITileView): void {
        view.display = null;
        view.state = null;
        this.invalidate();
        this._onViewUnbinded(view);
    }

    private _bindDisplay(display: ITileDisplay): void {
        this._display = display;
        this._displayPropertyObserver = this._display.propertyChangedObservable.add(this._onDisplayPropertyChanged.bind(this));
        for (const view of this._pipeline.view) {
            view.display = this._display;
        }
        this.invalidate();
        this._onDisplayBinded(display);
    }

    private _unbindDisplay(display: ITileDisplay): void {
        this._displayPropertyObserver?.dispose();
        for (const view of this._pipeline.view) {
            view.display = null;
        }
        this._display = null;
        this.invalidate();
        this._onDisplayUnbinded(display);
    }

    private _addSortedLayer(layer: ITileMapLayer<T>): void {
        if (!this._orderedLayers) this._orderedLayers = [];
        this._orderedLayers.push(layer);
        this._orderedLayers.sort((a, b) => a.zindex - b.zindex); // sort by zindex
    }

    private _removeSortedLayer(layer: ITileMapLayer<T>): void {
        if (this._orderedLayers) {
            const index = this._orderedLayers.findIndex((l) => l === layer);
            if (index !== -1) {
                this._orderedLayers.splice(index, 1);
            }
        }
    }

    private _onDisplayPropertyChanged(display: PropertyChangedEventArgs<ITileDisplay, unknown>, state: EventState): void {
        switch (display.propertyName) {
            case "size": {
                this.invalidate();
                this._onDisplayResized(display.source);
                break;
            }
            case "position": {
                this.invalidate();
                this._onDisplayTranslated(display.source);
                break;
            }
            default: {
                break;
            }
        }
    }

    protected _onDisplayUnbinded(display: ITileDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayBinded(display: ITileDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayResized(display: ITileDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayTranslated(display: ITileDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onLayerAdded(layer: ITileMapLayer<T>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onLayerRemoved(layer: ITileMapLayer<T>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onViewUnbinded(view: ITileView): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onViewBinded(view: ITileView): void {
        /* nothing to do here - overrided by subclasses */
    }
}
