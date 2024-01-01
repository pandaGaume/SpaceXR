import { EventState, Observable, Observer } from "../../events/events.observable";
import { TileConsumerBase } from "../pipeline/tiles.pipeline.consumer";
import { ITilePipeline, ITilePipelineBuilder, ITileView, IsTilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITile, ITileDisplay, ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationApi, IsTileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { TileNavigation } from "../navigation";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { ITileMap, ITileMapLayer } from "./tiles.map.interfaces";
import { Nullable } from "../../types";
import { IEnvelope } from "../../geography";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { Rectangle } from "../../geometry/geometry.rectangle";

export class TileMapBase<T> extends TileConsumerBase<T> implements ITileMap<T> {
    _layerAddedObservable?: Observable<ITileMapLayer<T>>;
    _layerRemovedObservable?: Observable<ITileMapLayer<T>>;

    protected _display: ITileDisplay;
    protected _navigation: ITileNavigationApi;
    protected _pipeline: ITilePipeline<T>;
    protected _layers?: Map<string, ITileMapLayer<T>>;

    // internal
    protected _orderedLayers?: ITileMapLayer<T>[];

    _viewAddedObserver: Nullable<Observer<ITileView>>;
    _viewRemovedObserver: Nullable<Observer<ITileView>>;

    _invalidBounds?: IEnvelope;
    _invalidRect?: IRectangle;

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

    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void {
        this._defineInvalidateBounds(eventData);
    }

    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void {
        this._defineInvalidateBounds(eventData);
    }

    protected _defineInvalidateBounds(eventData: Array<ITile<T>>): void {
        let env: IEnvelope | undefined;
        let rect: IRectangle | undefined;
        for (const tile of eventData) {
            const b = tile.bounds;
            if (b) {
                if (!env) {
                    env = b.clone();
                } else {
                    env.unionInPlace(b);
                }
            }
            const r = tile.rect;
            if (r) {
                if (!rect) {
                    rect = r.clone();
                } else {
                    rect.unionInPlace(r);
                }
            }
        }
        if (env) {
            this._invalidateEnvelope(env);
        }
        if (rect) {
            this._invalidateRectangle(rect);
        }
    }

    protected _invalidateEnvelope(env: IEnvelope): void {
        // may be cumulative
        this._invalidBounds = this._invalidBounds ? this._invalidBounds.unionInPlace(env) : env;
    }

    protected _invalidateRectangle(rect: IRectangle): void {
        // may be cumulative
        this._invalidRect = this._invalidRect ? this._invalidRect.unionInPlace(rect) : rect;
    }

    protected *_getActivTiles(rect?: IRectangle): IterableIterator<ITile<T>> {
        for (const l of this._orderedLayers ?? []) {
            if (l.enabled && l.provider.enabled) {
                yield* l.provider.activTiles.intersect(rect);
            }
        }
    }

    protected _doValidate() {
        const tiles = this._getActivTiles(this._invalidRect);
        this._displayTiles(tiles);
        this._invalidBounds = undefined;
        this._invalidRect = undefined;
    }

    protected _displayTiles(tiles: IterableIterator<ITile<T>>) {}
}
