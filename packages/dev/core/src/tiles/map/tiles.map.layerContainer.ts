import { Observable } from "../../events";
import { ITileMapLayer, ITileMapLayerContainer } from "./tiles.map.interfaces";

export class LayerContainer<T, L extends ITileMapLayer<T>> implements ITileMapLayerContainer<T, L> {
    _layerAddedObservable?: Observable<L>;
    _layerRemovedObservable?: Observable<L>;
    protected _layers?: Array<L>;

    // internal
    // layer ordered by zindex
    protected _zIndexOrderedLayers?: Array<L>;

    public get layerAddedObservable(): Observable<L> {
        if (!this._layerAddedObservable) {
            this._layerAddedObservable = new Observable<L>();
        }
        return this._layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<L> {
        if (!this._layerRemovedObservable) {
            this._layerRemovedObservable = new Observable<L>();
        }
        return this._layerRemovedObservable;
    }

    public *getLayers(predicate?: (l: L) => boolean, sorted: boolean = true): IterableIterator<L> {
        if (sorted) {
            yield* this.getOrderedLayers(predicate);
            return;
        }
        if (this._layers) {
            for (const item of this._layers) {
                if (!predicate || predicate(item)) yield item;
            }
        }
    }

    public *getOrderedLayers(predicate?: (l: L) => boolean): IterableIterator<L> {
        if (this._zIndexOrderedLayers) {
            if (predicate) {
                for (const layer of this._zIndexOrderedLayers ?? []) {
                    if (predicate(layer)) yield layer;
                }
            } else {
                yield* this._zIndexOrderedLayers ?? [];
            }
        }
    }

    public addLayer(layer: L): void {
        if (!this._layers) this._layers = [];

        this._layers.push(layer);
        this._addSortedLayer(layer);
        if (this._layerAddedObservable && this._layerAddedObservable.hasObservers()) {
            this._layerAddedObservable.notifyObservers(layer, -1, this, this);
        }
        this._onLayerAdded(layer);
    }

    public removeLayer(layer: L): void {
        const index = this._layers?.findIndex((l) => l === layer);
        if (index == undefined || index == -1) {
            return;
        }
        const container = this._layers?.[index];
        if (!container) {
            return;
        }
        this._layers?.splice(index, 1);
        this._removeSortedLayer(layer);
        this._onLayerRemoved(layer);
        if (this._layerRemovedObservable && this._layerRemovedObservable.hasObservers()) {
            this._layerRemovedObservable.notifyObservers(layer, -1, this, this);
        }
    }

    public clear(): void {
        if (this._layers) {
            for (const layer of this._layers) {
                this._removeSortedLayer(layer);
                this._onLayerRemoved(layer);
                if (this._layerRemovedObservable && this._layerRemovedObservable.hasObservers()) {
                    this._layerRemovedObservable.notifyObservers(layer, -1, this, this);
                }
            }
            this._layers = [];
        }
    }

    private _addSortedLayer(layer: L): void {
        if (!this._zIndexOrderedLayers) this._zIndexOrderedLayers = [];
        this._zIndexOrderedLayers.push(layer);
        this._zIndexOrderedLayers.sort((a, b) => a.zindex - b.zindex); // sort by zindex
    }

    private _removeSortedLayer(layer: L): void {
        if (this._zIndexOrderedLayers) {
            const index = this._zIndexOrderedLayers.findIndex((l) => l === layer);
            if (index !== -1) {
                this._zIndexOrderedLayers.splice(index, 1);
            }
        }
    }

    protected _onLayerAdded(layer: L): void {}

    protected _onLayerRemoved(layer: L): void {}
}
