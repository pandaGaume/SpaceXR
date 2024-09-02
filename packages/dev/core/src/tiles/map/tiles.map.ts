import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationState, TileNavigationState } from "../navigation";
import { IDisplay, ITileMap, ITileMapLayer, ITileMapLayerContainer, ITileMapLayerView, ITileMapLayerViewContainer } from "./tiles.map.interfaces";
import { Nullable } from "../../types";
import { IGeo2 } from "../../geography/geography.interfaces";
import { ITileView } from "../pipeline";
import { ValidableBase } from "../../validable";
import { OrderedCollection } from "../../collections/orderedCollection";
import { IOrderedCollection } from "../../collections/collections.interfaces";
import { TileMapLayerView } from "./tiles.map.layerView";
import { TileView } from "./tiles.map.view";

export class TileMapBase<T> extends ValidableBase implements ITileMap<T> {
    protected _display: IDisplay;
    protected _navigation: ITileNavigationState;
    protected _view: ITileView;
    protected _layerAddedObserver: Nullable<Observer<Array<ITileMapLayer<T>>>>;
    protected _layerRemovedObserver: Nullable<Observer<Array<ITileMapLayer<T>>>>;
    protected _layers: ITileMapLayerContainer<T>;
    protected _layerViewAddedObserver: Nullable<Observer<Array<ITileMapLayerView<T>>>>;
    protected _layerViewRemovedObserver: Nullable<Observer<Array<ITileMapLayerView<T>>>>;
    protected _layerViews: ITileMapLayerViewContainer<T>;

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileMap<T>, unknown>>;
    _navigationUpdatedObserver?: Nullable<Observer<boolean>>;
    _displayPropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<IDisplay, unknown>>>;
    _navInstanceCache?: ITileNavigationState;

    /// <summary>
    /// Create a new tile map.
    /// <param name="name">The map name.</param>
    /// <param name="display">The map display.</param>
    /// <param name="pipeline">The underlying pipeline. May be a Pipeline object or a PipelineBuilder. If Ommitedn pipeline is created unsing _buildDefaultPipeline() function which may be ovverided.</param>
    /// <param name="nav">The optional navigation api. May be a NavigationAPI object or a ITileMetrics object. In the second case, it will build a new TileNavigation(metrics).
    //  </param>
    /// </summary>
    public constructor(display: IDisplay, nav?: ITileNavigationState, container?: ITileMapLayerContainer<T>) {
        super();
        this._layers = container ?? this._createLayerContainer() ?? this._createLayerContainerInternal();
        this._layerAddedObserver = this._layers.addedObservable.add(this._onLayerAdded.bind(this));
        this._layerRemovedObserver = this._layers.removedObservable.add(this._onLayerRemoved.bind(this));

        this._display = display;
        this._bindDisplay(this._display);

        // build the navigation state according parameters
        this._navigation = nav ?? this._buildNavigationState() ?? new TileNavigationState();
        this._bindNavigation(this._navigation);

        this._view = this._buildView() ?? new TileView();

        this._layerViews = this._createLayerViewContainer(this._layers) ?? this._createLayerViewContainerInternal(this._layers);
        this._layerViewAddedObserver = this._layerViews.addedObservable.add(this._onLayerViewAdded.bind(this));
        this._layerViewRemovedObserver = this._layerViews.removedObservable.add(this._onLayerViewRemoved.bind(this));
    }

    public get layers(): ITileMapLayerContainer<T> {
        return this._layers;
    }

    public get layerViews(): ITileMapLayerViewContainer<T> {
        return this._layerViews;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileMap<T>, unknown>> {
        if (!this._propertyChangedObservable) this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileMap<T>, unknown>>();
        return this._propertyChangedObservable;
    }

    public get display(): Nullable<IDisplay> {
        return this._display;
    }

    public get navigation(): ITileNavigationState {
        return this._navigation;
    }

    public get view(): ITileView {
        return this._view;
    }

    public dispose() {
        super.dispose();
        this._navigationUpdatedObserver?.disconnect();
        this._displayPropertyObserver?.disconnect();
        this._layerAddedObserver?.disconnect();
        this._layerRemovedObserver?.disconnect();
        this._layerViewAddedObserver?.disconnect();
        this._layerViewRemovedObserver?.disconnect();
    }

    // navigation proxy
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): TileMapBase<T> {
        this._navigation.setViewMap(center, zoom, rotation);
        return this;
    }

    public zoomMap(delta: number): TileMapBase<T> {
        this._navigation.zoomMap(delta);
        return this;
    }

    public zoomInMap(delta: number): TileMapBase<T> {
        this._navigation.zoomInMap(delta);
        return this;
    }

    public zoomOutMap(delta: number): TileMapBase<T> {
        this._navigation.zoomOutMap(delta);
        return this;
    }

    public translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): TileMapBase<T> {
        this._navigation.translateUnitsMap(tx, ty, metrics);
        return this;
    }

    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number): TileMapBase<T> {
        this._navigation.translateMap(lat, lon);
        return this;
    }

    public rotateMap(r: number): TileMapBase<T> {
        this._navigation.rotateMap(r);
        return this;
    }

    public get isValid(): boolean {
        return super.isValid && this._layers?.isValid && this._layerViews?.isValid;
    }

    protected _doValidate() {
        this._layers?.validate();
        this._layerViews?.validate();
    }

    protected _onLayerAdded(eventData: Array<ITileMapLayer<T>>, eventstate: EventState): void {
        this._layerViews.add(...eventData.map((l) => this._createLayerView(l)));
        this.invalidate();
    }

    protected _onLayerRemoved(eventData: Array<ITileMapLayer<T>>, eventstate: EventState): void {
        const toRemove = Array.from(this._layerViews.get((v) => eventData.includes(v.layer)));
        if (toRemove?.length) {
            this._layerViews.remove(...toRemove);
            this.invalidate();
        }
    }

    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<T>>, eventstate: EventState): void {}

    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<T>>, eventstate: EventState): void {}

    // end navigation proxy
    private _onNavigationUpdatedInternal(event: boolean, state: EventState): void {
        if (event) {
            this.invalidate();
            this._onNavigationUpdated(this._navigation);
        }
    }

    private _onDisplayPropertyChanged(event: PropertyChangedEventArgs<IDisplay, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "size": {
                this.invalidate();
                this._onDisplayResized(event.source);
                break;
            }
            default: {
                break;
            }
        }
    }

    private _bindDisplay(display: Nullable<IDisplay>): void {
        if (display) {
            this._display = display;
            this._displayPropertyObserver = this._display?.propertyChangedObservable?.add(this._onDisplayPropertyChanged.bind(this));
            if (this._layerViews) {
                for (const l of this._layerViews) {
                    l.display = display;
                }
            }
        }
        this.invalidate();
        this._onDisplayBinded(display);
    }

    private _bindNavigation(nav?: ITileNavigationState): void {
        this._navigationUpdatedObserver?.disconnect();
        if (nav) {
            this._navigationUpdatedObserver = this._navigation.validationObservable?.add(this._onNavigationUpdatedInternal.bind(this));
            if (this._layerViews) {
                for (const l of this._layerViews) {
                    l.navigation = nav;
                }
            }
        }
        this.invalidate();
        this._onNavigationBinded(nav);
    }

    protected _createLayerContainer(): ITileMapLayerContainer<T> {
        return this._createLayerContainerInternal();
    }

    protected _createLayerViewContainer(layers: ITileMapLayerContainer<T>): IOrderedCollection<ITileMapLayerView<T>> {
        return this._createLayerViewContainerInternal(layers);
    }

    protected _createLayerView(layer: ITileMapLayer<T>): ITileMapLayerView<T> {
        return this._createLayerViewInternal(layer);
    }

    protected _onDisplayUnbinded(display: Nullable<IDisplay>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayBinded(display: Nullable<IDisplay>): void {
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

    protected _onDisplayResized(display: IDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayTranslated(display: IDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _buildNavigationState(): ITileNavigationState {
        return new TileNavigationState();
    }

    protected _buildView(): ITileView {
        return new TileView();
    }

    private _createLayerContainerInternal(): ITileMapLayerContainer<T> {
        return new OrderedCollection<ITileMapLayer<T>>();
    }

    private _createLayerViewContainerInternal(layers: ITileMapLayerContainer<T>): IOrderedCollection<ITileMapLayerView<T>> {
        return new OrderedCollection<ITileMapLayerView<T>>(...Array.from(this._layers).map((l) => this._createLayerView(l) ?? this._createLayerViewInternal(l)));
    }

    private _createLayerViewInternal(layer: ITileMapLayer<T>): ITileMapLayerView<T> {
        return new TileMapLayerView(layer, this._display, this._navigation, this._view);
    }
}
