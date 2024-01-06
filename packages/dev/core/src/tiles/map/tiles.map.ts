import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { TileConsumerBase, TilePipelineBuilder, TileView, ITilePipeline, ITilePipelineBuilder, ITileView, IsTilePipelineBuilder } from "../pipeline";
import { ITileDisplay, ITileSystemBounds } from "../tiles.interfaces";
import { ITileNavigationState, TileNavigationState } from "../navigation";
import { ITileMap, ITileMapLayer } from "./tiles.map.interfaces";
import { Nullable } from "../../types";
import { IGeo2 } from "../../geography/geography.interfaces";
import { TileSystemBounds } from "../tile.system";

export class TileMapBase<T> extends TileConsumerBase<T> implements ITileMap<T> {
    _layerAddedObservable?: Observable<ITileMapLayer<T>>;
    _layerRemovedObservable?: Observable<ITileMapLayer<T>>;

    protected _display: Nullable<ITileDisplay>;
    protected _navigation: ITileNavigationState;
    protected _pipeline: ITilePipeline<T>;
    protected _layers?: Map<string, ITileMapLayer<T>>;

    // internal
    protected _orderedLayers?: ITileMapLayer<T>[];

    _pipelinePropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>>;
    _navigationUpdatedObserver?: Nullable<Observer<ITileNavigationState>>;
    _displayPropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileDisplay, unknown>>>;

    /// <summary>
    /// Create a new tile map.
    /// <param name="name">The map name.</param>
    /// <param name="display">The map display.</param>
    /// <param name="pipeline">The underlying pipeline. May be a Pipeline object or a PipelineBuilder. If Ommitedn pipeline is created unsing _buildDefaultPipeline() function which may be ovverided.</param>
    /// <param name="nav">The optional navigation api. May be a NavigationAPI object or a ITileMetrics object. In the second case, it will build a new TileNavigation(metrics).
    //  </param>
    /// </summary>
    public constructor(name: string, display?: Nullable<ITileDisplay>, pipeline?: ITilePipeline<T> | ITilePipelineBuilder<T>, nav?: ITileNavigationState) {
        super(name ?? "");

        if (!pipeline) {
            pipeline = this._buildDefaultPipeline();
        }

        if (IsTilePipelineBuilder<T>(pipeline)) {
            pipeline = pipeline.build();
        }
        this._pipeline = pipeline;
        this._pipelinePropertyObserver = this._pipeline.propertyChangedObservable.add(this._onPipelinePropertyChanged.bind(this));

        // as TileConsumer, link the map to the pipeline
        this._pipeline.linkTo(this);

        this._display = display ?? null;
        this._bindDisplay(this._display);

        // build the navigation state according parameters
        nav = nav ?? new TileNavigationState();
        this._navigation = nav;
        this._bindNavigation(this._navigation);

        // link the views to the map (ie navigation state and display)
        if (this._pipeline.view) {
            this._bindView(this._pipeline.view);
        }
    }

    protected _buildDefaultPipeline(): ITilePipeline<T> {
        return new TilePipelineBuilder<T>().build();
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
            this._unbindDisplay(this._display);
            this._display = display;
            this._bindDisplay(this._display);
        }
    }

    public get navigation(): ITileNavigationState {
        return this._navigation;
    }

    public set navigation(nav: ITileNavigationState) {
        if (this._navigation !== nav) {
            this._unbindNavigation(this._navigation);
            this._navigation = nav;
            this._bindNavigation(this._navigation);
        }
    }

    public get pipeline(): ITilePipeline<T> {
        return this._pipeline;
    }

    public *getLayers(predicate?: (l: ITileMapLayer<T>) => boolean, sorted: boolean = true): IterableIterator<ITileMapLayer<T>> {
        if (sorted) {
            yield* this.getOrderedLayers(predicate);
            return;
        }

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
            // first add the provider to the pipeline
            this._pipeline.producer.addProvider(layer.provider);

            // now verify the view and associated metrics
            const view = this._pipeline.view;
            if (!view) {
                this._pipeline.view = new TileView(`${this.name}.view`, layer.provider.metrics, undefined, undefined, layer.zoomOffset);
            } else {
                if (layer.zoomOffset !== undefined) {
                    // we add the zoom offset to the view.
                    if (view.tryAddZOffset(layer.zoomOffset)) {
                        // offset added to the view.
                    }
                }
            }
            this._layers.set(layer.name, layer);
            this._addSortedLayer(layer);
            this._updateNavigationBounds();
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
            this._pipeline.producer.removeProvider(layer.provider.name);
            this._updateNavigationBounds();
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
        this._pipelinePropertyObserver?.disconnect();
        this._pipeline.unlinkFrom(this);
        if (this._pipeline.view) {
            this._unbindView(this._pipeline.view);
        }
        if (this._display) {
            this._unbindDisplay(this._display);
        }
        this._displayPropertyObserver?.disconnect();
    }

    // navigation proxy
    public setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): TileMapBase<T> {
        this._navigation.setView(center, zoom, rotation).validate();
        return this;
    }

    public zoomIn(delta: number): TileMapBase<T> {
        this._navigation.zoomIn(delta).validate();
        return this;
    }

    public zoomOut(delta: number): TileMapBase<T> {
        this._navigation.zoomOut(delta).validate();
        return this;
    }

    public translatePixel(tx: number, ty: number): TileMapBase<T> {
        this._navigation.translatePixel(tx, ty).validate();
        return this;
    }

    public translate(lat: IGeo2 | Array<number> | number, lon?: number): TileMapBase<T> {
        this._navigation.translate(lat, lon).validate();
        return this;
    }

    public rotate(r: number): TileMapBase<T> {
        this._navigation.rotate(r).validate();
        return this;
    }
    // end navigation proxy
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

    private _onNavigationUpdated(event: ITileNavigationState, state: EventState): void {
        this.invalidate();
    }

    private _onDisplayPropertyChanged(event: PropertyChangedEventArgs<ITileDisplay, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "size": {
                this.invalidate();
                this._onDisplayResized(event.source);
                break;
            }
            case "position": {
                this.invalidate();
                this._onDisplayTranslated(event.source);
                break;
            }
            default: {
                break;
            }
        }
    }

    private _onPipelinePropertyChanged(event: PropertyChangedEventArgs<ITilePipeline<T>, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "view": {
                this._unbindView(<ITileView>event.oldValue);
                this._bindView(<ITileView>event.newValue);
                break;
            }
            default: {
                break;
            }
        }
    }

    private _bindView(view: ITileView): void {
        if (view) {
            view.display = this._display;
            view.state = this._navigation;
        }
        this.invalidate();
        this._onViewBinded(view);
    }

    private _unbindView(view: ITileView): void {
        if (view) {
            view.display = null;
            view.state = null;
        }
        this.invalidate();
        this._onViewUnbinded(view);
    }

    private _bindDisplay(display: Nullable<ITileDisplay>): void {
        if (display) {
            this._display = display;
            this._displayPropertyObserver = this._display.propertyChangedObservable.add(this._onDisplayPropertyChanged.bind(this));
        }
        if (this._pipeline.view) {
            this._pipeline.view.display = this._display;
        }
        this.invalidate();
        this._onDisplayBinded(display);
    }

    private _unbindDisplay(display: Nullable<ITileDisplay>): void {
        this._displayPropertyObserver?.disconnect();
        this._display = null;
        if (this._pipeline.view) {
            this._pipeline.view.display = null;
        }
        this.invalidate();
        this._onDisplayUnbinded(display);
    }

    private _bindNavigation(nav?: ITileNavigationState): void {
        if (nav) {
            this._navigationUpdatedObserver = this._navigation.stateChangedObservable.add(this._onNavigationUpdated.bind(this));
        }
        if (this._pipeline.view) {
            this._pipeline.view.state = this._navigation;
        }

        this.invalidate();
        this._onNavigationBinded(nav);
    }

    private _unbindNavigation(nav?: ITileNavigationState): void {
        this._navigationUpdatedObserver?.disconnect();
        if (this._pipeline.view) {
            this._pipeline.view.state = null;
        }
        this.invalidate();
        this._onNavigationUnbinded(nav);
    }

    private _updateNavigationBounds(): void {
        // first get the overall bounds for all the layers
        let b: Nullable<ITileSystemBounds> = null;
        for (const layer of this.getLayers()) {
            if (b === null) {
                b = new TileSystemBounds(layer.provider.metrics);
                continue;
            }
            b.unionInPlace(layer.provider.metrics);
        }
        // the assign the bounds to the navigation state
        if (b != null) {
            this._navigation.bounds.maxLOD = b.maxLOD;
            this._navigation.bounds.minLOD = b.minLOD;
            this._navigation.bounds.maxLatitude = b.maxLatitude;
            this._navigation.bounds.minLatitude = b.minLatitude;
            this._navigation.bounds.maxLongitude = b.maxLongitude;
            this._navigation.bounds.minLongitude = b.minLongitude;
        }
    }

    protected _onDisplayUnbinded(display: Nullable<ITileDisplay>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayBinded(display: Nullable<ITileDisplay>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationUnbinded(nav?: ITileNavigationState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationBinded(nav?: ITileNavigationState): void {
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
