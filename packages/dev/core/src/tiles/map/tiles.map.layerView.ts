import { IWeighted } from "../../collections/collections.interfaces";
import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
import { ITileView } from "../pipeline";
import { AbstractTileProvider } from "../providers";
import { ITile } from "../tiles.interfaces";
import { IDisplay, ITileMapLayer, ITileMapLayerView } from "./tiles.map.interfaces";
import { TileView } from "./tiles.map.view";

export class TileMapLayerView<T> extends AbstractTileProvider<T> implements ITileMapLayerView<T> {
    private _weightChangedObservable?: Observable<IWeighted>;

    private _layer: ITileMapLayer<T>;
    private _layerObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>>;
    private _view: ITileView;
    private _navigation: Nullable<ITileNavigationState> = null;
    private _navigationObserver: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>> = null;
    private _display: Nullable<IDisplay> = null;
    private _displayObserver: Nullable<Observer<PropertyChangedEventArgs<IDisplay, unknown>>> = null;

    public constructor(layer: ITileMapLayer<T>, display: Nullable<IDisplay>, navigation: Nullable<ITileNavigationState>, source: ITileView) {
        super();
        this._layer = layer;
        this._layerObserver = layer.propertyChangedObservable.add(this._onLayerPropertyChanged.bind(this));

        this.navigation = navigation;
        this.display = display;

        this._view = source;
        this._view?.linkTo(this);

        // ensure the factory has the right metrics and namespace to build bounds.
        this.factory.withMetrics(this._layer.metrics).withNamespace(this._layer.name);
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

    public get navigation(): Nullable<ITileNavigationState> {
        return this._navigation;
    }

    public set navigation(value: Nullable<ITileNavigationState>) {
        if (this._navigation !== value) {
            const tmp = this._navigation;
            if (tmp) {
                this._navigationObserver?.disconnect();
                this._navigationObserver = null;
            }
            this._navigation = value;
            if (this._navigation) {
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

    public get view(): ITileView {
        return this._view;
    }

    public dispose(): void {
        super.dispose();
        this._view?.unlinkFrom(this);
        this._layerObserver?.disconnect();
        this._displayObserver?.disconnect();
        this._navigationObserver?.disconnect();
    }

    protected _buildSource(): ITileView {
        return new TileView();
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
        if (this._view && this._navigation && this._display) {
            this._view.setContext(this.navigation, this._display, this.metrics, { zoomOffset: this.layer.zoomOffset });
        }
    }
}
