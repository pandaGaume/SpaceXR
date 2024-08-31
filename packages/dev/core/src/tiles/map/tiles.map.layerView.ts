import { IWeighted } from "../../collections/collections.interfaces";
import { EventState, Observable, Observer, PropertyChangedEventArgs } from "../../events";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
import { ITileView, TileView } from "../pipeline";
import { AbstractTileProvider } from "../providers";
import { ITile, ITileMetrics } from "../tiles.interfaces";
import { IDisplay, ITileMapLayer, ITileMapLayerView } from "./tiles.map.interfaces";

export class TileMapLayerView<T> extends AbstractTileProvider<T> implements ITileMapLayerView<T> {
    private _weightChangedObservable?: Observable<IWeighted>;

    private _layer: ITileMapLayer<T>;
    private _layerObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>>;
    private _view: ITileView;
    private _ownView: boolean;

    public constructor(layer: ITileMapLayer<T>, source?: ITileView) {
        super();
        this._layer = layer;
        this._layerObserver = layer.propertyChangedObservable.add(this._onLayerPropertyChanged.bind(this));

        this._ownView = source === undefined || source === null;
        this._view = this._ownView ? this._buildSource() : source!;
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

    public get view(): ITileView {
        return this._view;
    }

    public dispose(): void {
        super.dispose();
        this._view?.unlinkFrom(this);
        if (this._ownView) {
            this._view.dispose();
        }
        this._layerObserver?.disconnect();
    }

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<IDisplay>, metrics: ITileMetrics, dispatchEvent?: boolean): void {
        this._view?.setContext(state, display, metrics, dispatchEvent);
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

    public _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T> {
        return this._layer.provider.fetchContent(tile, callback);
    }
}
