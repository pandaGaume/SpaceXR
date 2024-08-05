import { Observable } from "../../events";
import { IDisposable } from "../../types";
import { ValidableBase } from "../../validable";
import { ITileMapLayer, ITileMapLayerContainer, ITileMapLayerView } from "./tiles.map.interfaces";
import { TileMapLayerView } from "./tiles.map.layerView";

export class TileMapLayerViewContainer<T, L extends ITileMapLayer<T>> extends ValidableBase implements ITileMapLayerContainer<T, L>, IDisposable {
    private _layerAddedObservable?: Observable<L>;
    private _layerRemovedObservable?: Observable<L>;

    protected _layers: Map<string, ITileMapLayerView<T, L>>;
    protected _zIndexOrderedLayers?: Array<L>;

    public constructor() {
        super();
        this._layers = new Map<string, ITileMapLayerView<T, L>>();
    }

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

    public *getLayers(predicate?: (k: string, l: L) => boolean, sorted: boolean = true): IterableIterator<L> {
        if (sorted) {
            yield* this.getOrderedLayers(predicate);
            return;
        }
        if (this._layers) {
            for (const [key, item] of this._layers) {
                if (!predicate || predicate(key, item.layer)) yield item.layer;
            }
        }
    }

    public *getOrderedLayers(predicate?: (k: string, l: L) => boolean): IterableIterator<L> {
        if (this._zIndexOrderedLayers) {
            if (predicate) {
                for (const layer of this._zIndexOrderedLayers ?? []) {
                    if (predicate(layer.name, layer)) yield layer;
                }
            } else {
                yield* this._zIndexOrderedLayers ?? [];
            }
        }
    }

    public addLayer(layer: L): void {
        const view = this._buildLayerView(layer) ?? new TileMapLayerView<T, L>(layer);
        this._layers.set(layer.name, view);
        this._addSortedLayer(layer);
        if (this._layerAddedObservable && this._layerAddedObservable.hasObservers()) {
            this._layerAddedObservable.notifyObservers(layer, -1, this, this);
        }
        this._onLayerAdded(layer);
        this._onLayerViewAdded(view);
    }

    public removeLayer(layer: L): void {
        const k = layer.name;
        const view = this._layers.get(k);
        if (!view) {
            return;
        }
        this._layers?.delete(k);
        this._removeSortedLayer(layer);
        this._onLayerViewRemoved(view);
        view.dispose();
        this._onLayerRemoved(layer);
        if (this._layerRemovedObservable && this._layerRemovedObservable.hasObservers()) {
            this._layerRemovedObservable.notifyObservers(layer, -1, this, this);
        }
    }

    public clear(): void {
        if (this._layers) {
            const toRemove = Array.from(this._layers.values()).map((v) => v.layer);
            for (const l of toRemove) {
                this.removeLayer(l);
            }
        }
    }

    public dispose(): void {
        this.clear();
        this._layerAddedObservable?.clear();
        this._layerRemovedObservable?.clear();
    }

    protected _onLayerAdded(layer: L): void {}

    protected _onLayerRemoved(layer: L): void {}

    protected _onLayerViewAdded(view: ITileMapLayerView<T, L>): void {}

    protected _onLayerViewRemoved(view: ITileMapLayerView<T, L>): void {}

    protected _buildLayerView(layer: L): ITileMapLayerView<T, L> | undefined {
        return new TileMapLayerView<T, L>(layer);
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
}
