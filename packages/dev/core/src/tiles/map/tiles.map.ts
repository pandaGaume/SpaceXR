import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { ITileNavigationApi, ITileNavigationState, TileNavigationState } from "../navigation";
import { IDisplay, ITileMap, ITileMapLayer, ITileMapLayerContainer, ITileMapLayerView, ITileMapLayerViewContainer } from "./tiles.map.interfaces";
import { Nullable } from "../../types";
import { IGeo2 } from "../../geography/geography.interfaces";
import { ITileView } from "../pipeline";
import { ValidableBase } from "../../validable";
import { OrderedCollection } from "../../collections/orderedCollection";
import { IOrderedCollection } from "../../collections/collections.interfaces";
import { TileMapLayerView } from "./tiles.map.layerView";
import { TileView } from "./tiles.map.view";
import { TileNavigationApi } from "../navigation/tiles.navigation.api";

export class TileMapBase<T> extends ValidableBase implements ITileMap<T> {
    public static readonly DISPLAY_PROPERTY_NAME: string = "display";
    public static readonly NAVIGATION_PROPERTY_NAME: string = "nav";

    protected _display: Nullable<IDisplay> = null;
    protected _navigation: Nullable<ITileNavigationState> = null;
    protected _api: Nullable<ITileNavigationApi> = null;
    protected _view: ITileView;
    protected _layerAddedObserver: Nullable<Observer<Array<ITileMapLayer<T>>>>;
    protected _layerRemovedObserver: Nullable<Observer<Array<ITileMapLayer<T>>>>;
    protected _layers: ITileMapLayerContainer<T>;
    protected _layerViewAddedObserver: Nullable<Observer<Array<ITileMapLayerView<T>>>>;
    protected _layerViewRemovedObserver: Nullable<Observer<Array<ITileMapLayerView<T>>>>;
    protected _layerViews: ITileMapLayerViewContainer<T>;

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileMap<T>, unknown>>;
    _displayPropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<IDisplay, unknown>>>;
    _navigationPropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>>;
    _navigationValidableObserver?: Nullable<Observer<boolean>>;
    _navInstanceCache?: ITileNavigationState;

    /// <summary>
    /// Create a new tile map.
    /// <param name="name">The map name.</param>
    /// <param name="display">The map display.</param>
    /// <param name="pipeline">The underlying pipeline. May be a Pipeline object or a PipelineBuilder. If Ommitedn pipeline is created unsing _buildDefaultPipeline() function which may be ovverided.</param>
    /// <param name="nav">The optional navigation api. May be a NavigationAPI object or a ITileMetrics object. In the second case, it will build a new TileNavigation(metrics).
    //  </param>
    /// </summary>
    public constructor(display?: Nullable<IDisplay>, nav?: Nullable<ITileNavigationState>, container?: ITileMapLayerContainer<T>) {
        super();
        this._layers = container ?? this._buildLayerContainer() ?? this._buildLayerContainerInternal();
        this._layerAddedObserver = this._layers.addedObservable.add(this._onLayerAdded.bind(this));
        this._layerRemovedObserver = this._layers.removedObservable.add(this._onLayerRemoved.bind(this));

        this.display = display ?? null;
        this.navigationState = nav ?? this._buildNavigationState() ?? new TileNavigationState();
        this._view = this._buildView() ?? new TileView();

        this._layerViews = this._buildLayerViewContainer(this._layers) ?? this._buildLayerViewContainerInternal(this._layers);
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

    public set display(value: Nullable<IDisplay>) {
        this._bindDisplay(value);
    }

    public get navigationState(): Nullable<ITileNavigationState> {
        return this._navigation;
    }

    public set navigationState(value: Nullable<ITileNavigationState>) {
        this._bindNavigation(value);
    }

    public get view(): ITileView {
        return this._view;
    }

    public dispose() {
        super.dispose();
        this._navigationValidableObserver?.disconnect();
        this._displayPropertyObserver?.disconnect();
        this._layerAddedObserver?.disconnect();
        this._layerRemovedObserver?.disconnect();
        this._layerViewAddedObserver?.disconnect();
        this._layerViewRemovedObserver?.disconnect();
    }

    // navigation proxy
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): ITileNavigationApi {
        this._api?.setViewMap(center, zoom, rotation);
        for (const v of this._layerViews) {
            v.navigationApi?.setViewMap(center, zoom, rotation);
        }
        return this;
    }

    public zoomMap(delta: number): ITileNavigationApi {
        this._api?.zoomMap(delta);
        for (const v of this._layerViews) {
            v.navigationApi?.zoomMap(delta);
        }
        return this;
    }

    public zoomInMap(delta: number): ITileNavigationApi {
        this._api?.zoomInMap(delta);
        for (const v of this._layerViews) {
            v.navigationApi?.zoomInMap(delta);
        }
        return this;
    }

    public zoomOutMap(delta: number): ITileNavigationApi {
        this._api?.zoomOutMap(delta);
        for (const v of this._layerViews) {
            v.navigationApi?.zoomOutMap(delta);
        }
        return this;
    }

    public translateUnitsMap(tx: number, ty: number): ITileNavigationApi {
        this._api?.translateUnitsMap(tx, ty);
        for (const v of this._layerViews) {
            v.navigationApi?.translateUnitsMap(tx, ty);
        }
        return this;
    }

    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number): ITileNavigationApi {
        this._api?.translateMap(lat, lon);
        for (const v of this._layerViews) {
            v.navigationApi?.translateMap(lat, lon);
        }
        return this;
    }

    public rotateMap(r: number): ITileNavigationApi {
        this._api?.rotateMap(r);
        for (const v of this._layerViews) {
            v.navigationApi?.rotateMap(r);
        }
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
        const views = eventData.map((l) => this._buildLayerView(l)).filter((i): i is ITileMapLayerView<T> => i !== null && i !== undefined);
        if (views.length > 0) {
            this._layerViews.add(...views);
            this.invalidate();
        }
    }

    protected _onLayerRemoved(eventData: Array<ITileMapLayer<T>>, eventstate: EventState): void {
        const toRemove = Array.from(this._layerViews.get((v) => eventData.includes(v.layer)));
        if (toRemove?.length) {
            this._layerViews.remove(...toRemove);
            this.invalidate();
        }
    }

    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<T>>, eventstate: EventState): void {
        this._updateLayerNavigations(eventData);
    }

    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<T>>, eventstate: EventState): void {}

    protected _updateLayerNavigations(layers: Iterable<ITileMapLayerView<T>>): void {
        if (layers) {
            const nav = this.navigationState;
            if (nav) {
                for (const layerView of layers) {
                    layerView.navigationState?.copy(nav);
                }
            }
        }
    }

    // end navigation proxy
    protected _onNavigationValidationChanged(event: boolean, state: EventState): void {
        if (event && state.target === this._navigation) {
            this.invalidate();
            this._onNavigationUpdated(state.target);
        }
    }

    protected _onDisplayPropertyChanged(event: PropertyChangedEventArgs<IDisplay, unknown>, state: EventState): void {
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

    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {}

    private _bindDisplay(display: Nullable<IDisplay>): void {
        if (this._display != display) {
            const old = this.display;
            if (this._display) {
                this._displayPropertyObserver?.disconnect();
                this._displayPropertyObserver = null;
                this._onDisplayUnbinded(this._display);
            }

            this._display = display;
            if (this._display) {
                this._displayPropertyObserver = this._display.propertyChangedObservable?.add(this._onDisplayPropertyChanged.bind(this));
            }

            if (this._layerViews) {
                for (const l of this._layerViews) {
                    l.display = display;
                }
            }
            this.invalidate();
            this._onDisplayBinded(display);
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                this._propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, this._display, TileMapBase.DISPLAY_PROPERTY_NAME), -1, this, this);
            }
        }
    }

    private _bindNavigation(nav: Nullable<ITileNavigationState>): void {
        if (this._navigation != nav) {
            const old = this._navigation;
            if (this._navigation) {
                this._navigationValidableObserver?.disconnect();
                this._navigationValidableObserver = null;
                this._navigationPropertyObserver?.disconnect();
                this._navigationPropertyObserver = null;
                this._api?.dispose();
                this._api = null;
                this._onNavigationUnbinded(this._navigation);
            }

            this._navigation = nav;
            if (this._navigation) {
                this._api = new TileNavigationApi(this._navigation);
                this._navigationPropertyObserver = this._navigation.propertyChangedObservable?.add(this._onNavigationPropertyChanged.bind(this));
                this._navigationValidableObserver = this._navigation.validationObservable?.add(this._onNavigationValidationChanged.bind(this));
                this._updateLayerNavigations(this._layerViews);
            }

            this.invalidate();
            this._onNavigationBinded(nav);
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                this._propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, this._navigation, TileMapBase.NAVIGATION_PROPERTY_NAME), -1, this, this);
            }
        }
    }

    protected _buildLayerContainer(): ITileMapLayerContainer<T> {
        return this._buildLayerContainerInternal();
    }

    protected _buildLayerViewContainer(layers: ITileMapLayerContainer<T>): IOrderedCollection<ITileMapLayerView<T>> {
        return this._buildLayerViewContainerInternal(layers);
    }

    protected _buildLayerView(layer: ITileMapLayer<T>): Nullable<ITileMapLayerView<any>> {
        return this._buildLayerViewInternal(layer);
    }

    protected _onDisplayUnbinded(display: Nullable<IDisplay>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayBinded(display: Nullable<IDisplay>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationUnbinded(nav: Nullable<ITileNavigationState>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationBinded(nav: Nullable<ITileNavigationState>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationUpdated(nav: ITileNavigationState): void {
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

    private _buildLayerContainerInternal(): ITileMapLayerContainer<T> {
        return new OrderedCollection<ITileMapLayer<T>>();
    }

    private _buildLayerViewContainerInternal(layers: ITileMapLayerContainer<T>): IOrderedCollection<ITileMapLayerView<T>> {
        return new OrderedCollection<ITileMapLayerView<T>>(...Array.from(this._layers).map((l) => this._buildLayerView(l) ?? this._buildLayerViewInternal(l)));
    }

    private _buildLayerViewInternal(layer: ITileMapLayer<T>): ITileMapLayerView<any> {
        return new TileMapLayerView(layer, this._display, this._view);
    }
}
