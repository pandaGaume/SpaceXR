import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { ITileMetrics, ITileSystemBounds } from "../tiles.interfaces";
import { ITileNavigationState, TileNavigationState } from "../navigation";
import { ITileDisplay, ITileMap, ITileMapLayer } from "./tiles.map.interfaces";
import { Nullable } from "../../types";
import { IGeo2 } from "../../geography/geography.interfaces";
import { TileSystemBounds } from "../tiles.system";
import { ValidableBase } from "../../validable";

interface ITileMapLayerContainer<T, L extends ITileMapLayer<T>> {
    layer: L;
    validationObserver: Nullable<Observer<boolean>>;
}

export class TileMapBase<T, L extends ITileMapLayer<T>> extends ValidableBase implements ITileMap<T, L> {
    _layerAddedObservable?: Observable<L>;
    _layerRemovedObservable?: Observable<L>;

    protected _name: string;
    protected _display: Nullable<ITileDisplay>;
    protected _navigation: ITileNavigationState;
    protected _layers?: Array<ITileMapLayerContainer<T, L>>;

    // internal
    protected _orderedLayers?: L[];

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
    public constructor(name: string, display?: Nullable<ITileDisplay>, nav?: ITileNavigationState) {
        super();
        this._name = name ?? "";
        this._display = display ?? null;
        this._bindDisplay(this._display);

        // build the navigation state according parameters
        this._navigation = nav ?? new TileNavigationState();
        this._bindNavigation(this._navigation);
    }

    public get layerAddedObservable(): Observable<L> {
        if (!this._layerAddedObservable) this._layerAddedObservable = new Observable<L>();
        return this._layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<L> {
        if (!this._layerRemovedObservable) this._layerRemovedObservable = new Observable<L>();
        return this._layerRemovedObservable;
    }

    public get display(): Nullable<ITileDisplay> {
        return this._display;
    }

    public get navigation(): ITileNavigationState {
        return this._navigation;
    }

    public *getLayers(predicate?: (l: L) => boolean, sorted: boolean = true): IterableIterator<L> {
        if (sorted) {
            yield* this.getOrderedLayers(predicate);
            return;
        }
        if (this._layers) {
            for (const item of this._layers) {
                if (!predicate || predicate(item.layer)) yield item.layer;
            }
        }
    }

    public *getOrderedLayers(predicate?: (l: L) => boolean): IterableIterator<L> {
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

    public addLayer(layer: L): void {
        if (!this._layers) this._layers = [];
        const container: ITileMapLayerContainer<T, L> = {
            layer: layer,
            validationObserver: layer.validationObservable?.add(this._onLayerValidationChanged.bind(this)) ?? null,
        };
        this._layers.push(container);
        this._addSortedLayer(layer);

        this._onLayerAddedInternal(layer);
    }

    public removeLayer(layer: L): void {
        const index = this._layers?.findIndex((l) => l.layer === layer);
        if (index == undefined || index == -1) {
            return;
        }
        const container = this._layers?.[index];
        if (!container) {
            return;
        }
        if (container.validationObserver) {
            container.validationObserver.disconnect();
            container.validationObserver = null;
        }
        this._layers?.splice(index, 1);
        this._removeSortedLayer(layer);
        this._onLayerRemovedInternal(layer);
    }

    public dispose() {
        this._navigationUpdatedObserver?.disconnect();
        this._displayPropertyObserver?.disconnect();
        for (const container of this._layers ?? []) {
            if (container.validationObserver) {
                container.validationObserver.disconnect();
                container.validationObserver = null;
            }
        }
    }

    // navigation proxy
    public setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): TileMapBase<T, L> {
        this._navigation.setView(center, zoom, rotation).validate();
        return this;
    }

    public zooming(delta: number): TileMapBase<T, L> {
        this._navigation.zooming(delta).validate();
        return this;
    }

    public zoomIn(delta: number): TileMapBase<T, L> {
        this._navigation.zoomIn(delta).validate();
        return this;
    }

    public zoomOut(delta: number): TileMapBase<T, L> {
        this._navigation.zoomOut(delta).validate();
        return this;
    }

    public translatePixel(tx: number, ty: number, metrics?: ITileMetrics): TileMapBase<T, L> {
        this._navigation.translatePixel(tx, ty, metrics).validate();
        return this;
    }

    public translate(lat: IGeo2 | Array<number> | number, lon?: number): TileMapBase<T, L> {
        this._navigation.translate(lat, lon).validate();
        return this;
    }

    public rotate(r: number): TileMapBase<T, L> {
        this._navigation.rotate(r).validate();
        return this;
    }

    // end navigation proxy
    private _addSortedLayer(layer: L): void {
        if (!this._orderedLayers) this._orderedLayers = [];
        this._orderedLayers.push(layer);
        this._orderedLayers.sort((a, b) => a.zindex - b.zindex); // sort by zindex
    }

    private _removeSortedLayer(layer: L): void {
        if (this._orderedLayers) {
            const index = this._orderedLayers.findIndex((l) => l === layer);
            if (index !== -1) {
                this._orderedLayers.splice(index, 1);
            }
        }
    }

    private _onNavigationUpdatedInternal(event: ITileNavigationState, state: EventState): void {
        this.invalidate();
        this._updateLayersWithDisplayAndNavigation();
        this._onNavigationUpdated(event);
    }

    private _updateLayersWithDisplayAndNavigation() {
        for (const layer of this.getLayers()) {
            if (this._display && this._navigation) {
                layer.setContext(this._navigation, this._display);
            }
        }
    }

    private _onDisplayPropertyChanged(event: PropertyChangedEventArgs<ITileDisplay, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "size": {
                this.invalidate();
                this._updateLayersWithDisplayAndNavigation();
                this._onDisplayResized(event.source);
                break;
            }
            default: {
                break;
            }
        }
    }

    private _bindDisplay(display: Nullable<ITileDisplay>): void {
        if (display) {
            this._display = display;
            this._displayPropertyObserver = this._display.propertyChangedObservable?.add(this._onDisplayPropertyChanged.bind(this));
            this._updateLayersWithDisplayAndNavigation();
        }
        this.invalidate();
        this._onDisplayBinded(display);
    }

    private _bindNavigation(nav?: ITileNavigationState): void {
        if (nav) {
            this._navigationUpdatedObserver = this._navigation.stateChangedObservable.add(this._onNavigationUpdatedInternal.bind(this));
            this._updateLayersWithDisplayAndNavigation();
        }
        this.invalidate();
        this._onNavigationBinded(nav);
    }

    private _updateNavigationBounds(): void {
        // first get the overall bounds for all the layers
        let b: Nullable<ITileSystemBounds> = null;
        for (const layer of this.getLayers()) {
            if (b === null) {
                b = new TileSystemBounds(layer.metrics);
                continue;
            }
            b.unionInPlace(layer.metrics);
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

    private _onLayerAddedInternal(layer: L): void {
        // maintain the bounds
        this._updateNavigationBounds();
        // update the layer with current navigation and display
        layer.setContext(this._navigation, this._display);
        // invalidate the map
        this.invalidate();
        // we give the hand to other components
        this._onLayerAdded(layer);
        if (this._layerAddedObservable && this._layerAddedObservable.hasObservers()) {
            this._layerAddedObservable.notifyObservers(layer, -1, this, this);
        }
    }

    private _onLayerRemovedInternal(layer: L): void {
        // maintain the bounds
        this._updateNavigationBounds();
        // invalidate the map
        this.invalidate();
        // we give the hand to other components
        this._onLayerRemoved(layer);
        if (this._layerRemovedObservable && this._layerRemovedObservable.hasObservers()) {
            this._layerRemovedObservable.notifyObservers(layer, -1, this, this);
        }
    }

    // in response to layer validation process
    private _onLayerValidationChanged(valid: boolean, state: EventState): void {
        if (valid === false) {
            this.invalidate();
        }
    }

    protected _beforeValidate(): void {
        if (this._layers) {
            for (const container of this._layers) {
                container.layer.validate();
            }
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

    protected _onNavigationUpdated(nav?: ITileNavigationState): void {
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
}
