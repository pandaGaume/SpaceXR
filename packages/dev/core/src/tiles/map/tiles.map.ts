import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationState, TileNavigationState } from "../navigation";
import { IDisplay, isTileMapLayerProxy, ITileMap, ITileMapLayer, TileMapLayerContainerContentType } from "./tiles.map.interfaces";
import { isValidable, Nullable } from "../../types";
import { IEnvelope, IGeo2 } from "../../geography/geography.interfaces";
import { TileMapLayerContainer } from "./tiles.map.layerContainer";
import { hasTileSelectionContext, ITileView, TileView } from "../pipeline";
import { TileMapLayerView } from "./tiles.map.layerView";

export class TileMapBase<T, L extends ITileMapLayer<T>> extends TileMapLayerContainer<T> implements ITileMap<T, L, TileMapBase<T, L>> {
    protected _display: Nullable<IDisplay>;
    protected _navigation: ITileNavigationState;
    protected _view: ITileView;

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileMap<T, L, TileMapBase<T, L>>, unknown>>;
    _navigationUpdatedObserver?: Nullable<Observer<ITileNavigationState>>;
    _displayPropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<IDisplay, unknown>>>;

    /// <summary>
    /// Create a new tile map.
    /// <param name="name">The map name.</param>
    /// <param name="display">The map display.</param>
    /// <param name="pipeline">The underlying pipeline. May be a Pipeline object or a PipelineBuilder. If Ommitedn pipeline is created unsing _buildDefaultPipeline() function which may be ovverided.</param>
    /// <param name="nav">The optional navigation api. May be a NavigationAPI object or a ITileMetrics object. In the second case, it will build a new TileNavigation(metrics).
    //  </param>
    /// </summary>
    public constructor(display: IDisplay, nav?: ITileNavigationState) {
        super();
        this._display = display;
        this._bindDisplay(this._display);

        // build the navigation state according parameters
        this._navigation = nav ?? this._buildNavigationState() ?? new TileNavigationState();
        this._bindNavigation(this._navigation);

        this._view = this._buildView() ?? new TileView();
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileMap<T, L, TileMapBase<T, L>>, unknown>> {
        if (!this._propertyChangedObservable) this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileMap<T, L, TileMapBase<T, L>>, unknown>>();
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
    }

    // navigation proxy
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): TileMapBase<T, L> {
        this._navigation.setViewMap(center, zoom, rotation).validate();
        return this;
    }

    public zoomMap(delta: number): TileMapBase<T, L> {
        this._navigation.zoomMap(delta).validate();
        return this;
    }

    public zoomInMap(delta: number): TileMapBase<T, L> {
        this._navigation.zoomInMap(delta).validate();
        return this;
    }

    public zoomOutMap(delta: number): TileMapBase<T, L> {
        this._navigation.zoomOutMap(delta).validate();
        return this;
    }

    public translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): TileMapBase<T, L> {
        this._navigation.translateUnitsMap(tx, ty, metrics).validate();
        return this;
    }

    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number): TileMapBase<T, L> {
        this._navigation.translateMap(lat, lon).validate();
        return this;
    }

    public rotateMap(r: number): TileMapBase<T, L> {
        this._navigation.rotateMap(r).validate();
        return this;
    }

    public getGeoBounds(metrics: ITileMetrics): IEnvelope | undefined {
        return undefined;
    }

    // end navigation proxy
    private _onNavigationUpdatedInternal(event: ITileNavigationState, state: EventState): void {
        this.invalidate();
        for (const l of this._layers.values()) {
            const layer: ITileMapLayer<T> = isTileMapLayerProxy<T>(l) ? l.layer : l;
            if (isValidable(l)) {
                l.validate();
            }
            const offset = layer.zoomOffset ?? 0;
            const n = offset
                ? new TileNavigationState(this.navigation.center, this.navigation.lod + offset, this.navigation.azimuth?.value, this.navigation.bounds)
                : this.navigation;
            if (hasTileSelectionContext(l)) {
                l.setContext(n, this.display, layer.metrics, true);
            }
        }
        this._onNavigationUpdated(event);
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
        }
        this.invalidate();
        this._onDisplayBinded(display);
    }

    private _bindNavigation(nav?: ITileNavigationState): void {
        this._navigationUpdatedObserver?.disconnect();
        if (nav) {
            this._navigationUpdatedObserver = this._navigation.stateChangedObservable.add(this._onNavigationUpdatedInternal.bind(this));
        }
        this.invalidate();
        this._onNavigationBinded(nav);
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

    protected _onLayerAdded(layer: L): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onLayerRemoved(layer: L): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _buildNavigationState(): ITileNavigationState {
        return new TileNavigationState();
    }

    protected _buildView(): ITileView {
        return new TileView();
    }

    protected _onBeforeLayerAdded(layer: TileMapLayerContainerContentType<T>): TileMapLayerContainerContentType<T> {
        if (isTileMapLayerProxy<T>(layer)) {
            if (layer instanceof TileMapLayerView) {
                return layer;
            }
            return new TileMapLayerView(layer.layer, this.view);
        }
        return new TileMapLayerView(layer, this.view);
    }
}
