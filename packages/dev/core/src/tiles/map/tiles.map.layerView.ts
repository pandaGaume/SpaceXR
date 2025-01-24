import { IWeighted } from "../../collections/collections.interfaces";
import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { IsDisposable, Nullable } from "../../types";
import { ITileNavigationApi, ITileNavigationState, TileNavigationState } from "../navigation";
import { TileNavigationApi } from "../navigation/tiles.navigation.api";
import { hasTileSelectionContext, ISourceBlock, ITileSelectionContext, ITileView } from "../pipeline";
import { AbstractTileProvider } from "../providers";
import { ITile, ITileAddress } from "../tiles.interfaces";
import { IDisplay, ITileMapLayer, ITileMapLayerView } from "./tiles.map.interfaces";
import { TileView } from "./tiles.map.view";

export class TileMapLayerView<T> extends AbstractTileProvider<T> implements ITileMapLayerView<T> {
    private _weightChangedObservable?: Observable<IWeighted>;

    private _layer: ITileMapLayer<T>;
    private _layerObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>>;
    private _source: ISourceBlock<ITileAddress>;
    private _selectionContext?: ITileSelectionContext;
    private _ownSource: boolean = false;
    private _navigation: Nullable<ITileNavigationState> = null;
    private _navigationObserver: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>> = null;
    private _api: Nullable<ITileNavigationApi> = null;
    private _display: Nullable<IDisplay> = null;
    private _displayObserver: Nullable<Observer<PropertyChangedEventArgs<IDisplay, unknown>>> = null;

    public constructor(layer: ITileMapLayer<T>, display: Nullable<IDisplay>, source: ISourceBlock<ITileAddress>, selectionContext?: ITileSelectionContext) {
        super();
        // ensure the factory has the right metrics and namespace to build bounds.
        this.factory.withMetrics(layer.metrics);
        this._layer = layer;
        this._layerObserver = layer.propertyChangedObservable.add(this._onLayerPropertyChanged.bind(this));

        this.navigationState = this._buildNavigation();
        this.display = display;

        this._source = source ?? this._buildSource();
        this._source?.linkTo(this);

        if (!selectionContext) {
            if (hasTileSelectionContext(this._source)) {
                selectionContext = this._source as ITileSelectionContext;
            }
        }
        this._selectionContext = selectionContext;
    }

    public get navigationApi(): Nullable<ITileNavigationApi> {
        return this._api;
    }

    public get weightChangedObservable(): Observable<IWeighted> {
        if (!this._weightChangedObservable) {
            this._weightChangedObservable = new Observable<IWeighted>();
        }
        return this._weightChangedObservable;
    }

    public get weight(): number | undefined {
        return this._layer.weight;
    }

    public get name(): string {
        return this._layer.name;
    }

    public get layer(): ITileMapLayer<T> {
        return this._layer;
    }

    public get display(): Nullable<IDisplay> {
        return this._display;
    }

    public get navigationState(): Nullable<ITileNavigationState> {
        return this._navigation;
    }

    public set navigationState(value: Nullable<ITileNavigationState>) {
        if (this._navigation !== value) {
            const tmp = this._navigation;
            if (tmp) {
                this._navigationObserver?.disconnect();
                this._navigationObserver = null;
                this._api?.dispose();
                this._api = null;
            }
            this._navigation = value;
            if (this._navigation) {
                this._api = new TileNavigationApi(this._navigation, this.metrics);
                this._navigationObserver = this._navigation.propertyChangedObservable.add(this._onNavigationPropertyChanged.bind(this));
            }
            this._onNavigationChanged(tmp, value);
        }
    }

    public set display(value: Nullable<IDisplay>) {
        if (this._display !== value) {
            const tmp = this._display;
            if (tmp) {
                this._displayObserver?.disconnect();
                this._displayObserver = null;
            }
            this._display = value;
            if (this._display) {
                this._displayObserver = this._display.propertyChangedObservable.add(this._onDisplayPropertyChanged.bind(this));
            }
            this._onDisplayChanged(tmp, value);
        }
    }

    public get source(): ISourceBlock<ITileAddress> {
        return this._source;
    }

    public dispose(): void {
        super.dispose();
        this._navigation?.dispose();
        this._source?.unlinkFrom(this);
        if (this._ownSource && IsDisposable(this._source)) {
            this._source?.dispose();
        }
        this._layerObserver?.disconnect();
        this._displayObserver?.disconnect();
        this._navigationObserver?.disconnect();
    }

    protected _buildSource(): ITileView {
        this._ownSource = true;
        return new TileView();
    }

    protected _buildNavigation(): ITileNavigationState {
        return new TileNavigationState(undefined, undefined, undefined, this.metrics);
    }

    protected _onLayerPropertyChanged(eventData: PropertyChangedEventArgs<unknown, unknown>, eventState: EventState): void {
        // we survey the weight property of the layer to update the current view and messaging the map container that it need
        // to sort the layers again.
        switch (eventData.propertyName) {
            case "weight": {
                if (this._weightChangedObservable && this._weightChangedObservable.hasObservers()) {
                    this._weightChangedObservable.notifyObservers(this, -1, this, this);
                }
                break;
            }
        }
        this.invalidate();
    }

    protected _onNavigationChanged(oldValue: Nullable<ITileNavigationState>, newValue: Nullable<ITileNavigationState>): void {
        this.invalidate();
    }

    protected _onNavigationPropertyChanged(eventData: PropertyChangedEventArgs<ITileNavigationState, unknown>, eventState: EventState): void {
        this.invalidate();
    }

    protected _onDisplayChanged(oldValue: Nullable<IDisplay>, newValue: Nullable<IDisplay>): void {
        this.invalidate();
    }

    protected _onDisplayPropertyChanged(eventData: PropertyChangedEventArgs<IDisplay, unknown>, eventState: EventState): void {
        this.invalidate();
    }

    public _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T> {
        return this._layer.provider.fetchContent(tile, callback);
    }

    protected _doValidate(): void {
        this._selectionContext?.setContext(this.navigationState, this._display, this.metrics, { zoomOffset: this.layer.zoomOffset ?? 0 });
    }
}
