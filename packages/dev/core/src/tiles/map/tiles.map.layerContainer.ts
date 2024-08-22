import { EventState, Observable } from "../../events";
import { IDisposable, isValidable } from "../../types";
import { ValidableBase } from "../../validable";
import { ITileMapLayerContainer, TileMapLayerContainerContentType } from "./tiles.map.interfaces";

type TileMapLayerContainerItemType<T> = TileMapLayerContainerContentType<T>;

export class TileMapLayerContainer<T> extends ValidableBase implements ITileMapLayerContainer<T>, IDisposable {
    private _layerAddedObservable?: Observable<TileMapLayerContainerContentType<T>>;
    private _layerRemovedObservable?: Observable<TileMapLayerContainerContentType<T>>;

    protected _layers: Map<string, TileMapLayerContainerItemType<T>>;
    protected _zIndexOrderedLayers?: Array<TileMapLayerContainerContentType<T>>;

    public constructor() {
        super();
        this._layers = new Map<string, TileMapLayerContainerItemType<T>>();
    }

    public get layerAddedObservable(): Observable<TileMapLayerContainerContentType<T>> {
        if (!this._layerAddedObservable) {
            this._layerAddedObservable = new Observable<TileMapLayerContainerContentType<T>>();
        }
        return this._layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<TileMapLayerContainerContentType<T>> {
        if (!this._layerRemovedObservable) {
            this._layerRemovedObservable = new Observable<TileMapLayerContainerContentType<T>>();
        }
        return this._layerRemovedObservable;
    }

    public *getLayers(predicate?: (k: string, l: TileMapLayerContainerContentType<T>) => boolean, sorted: boolean = true): IterableIterator<TileMapLayerContainerContentType<T>> {
        if (sorted) {
            yield* this.getOrderedLayers(predicate);
            return;
        }
        if (this._layers) {
            for (const [key, item] of this._layers) {
                if (!predicate || predicate(key, item)) yield item;
            }
        }
    }

    public *getOrderedLayers(predicate?: (k: string, l: TileMapLayerContainerContentType<T>) => boolean): IterableIterator<TileMapLayerContainerContentType<T>> {
        if (this._zIndexOrderedLayers) {
            for (const l of this._zIndexOrderedLayers ?? []) {
                if (!predicate || predicate(l.name, l)) yield l;
            }
        }
    }

    public addLayer(layer: TileMapLayerContainerContentType<T>): void {
        layer = this._onBeforeLayerAdded(layer);
        this._layers.set(layer.name, layer);
        this._addSortedLayer(layer);
        if (this._layerAddedObservable && this._layerAddedObservable.hasObservers()) {
            this._layerAddedObservable.notifyObservers(layer, -1, this, this);
        }
        this._onLayerAdded(layer);
        this.invalidate();
    }

    public removeLayer(layer: TileMapLayerContainerContentType<T>): void {
        const k = layer.name;
        const l = this._layers.get(k);
        if (!l) {
            return;
        }

        this._layers?.delete(k);
        this._removeSortedLayer(l);
        this._onLayerRemoved(layer);
        if (this._layerRemovedObservable && this._layerRemovedObservable.hasObservers()) {
            this._layerRemovedObservable.notifyObservers(layer, -1, this, this);
        }
        this.invalidate();
    }

    public clear(): void {
        if (this._layers) {
            const toRemove = Array.from(this._layers.values());
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

    public get isValid(): boolean {
        if (!super.isValid) {
            return false;
        }
        return (
            this._zIndexOrderedLayers?.every((l) => {
                if (isValidable(l)) {
                    return l.isValid;
                }
                return true;
            }) ?? true
        );
    }

    protected _onChildrenValidation(eventData: Boolean, eventState: EventState) {
        // we survey the children invalidation to propagate the status.
        if (!eventData) {
            this.invalidate();
        }
    }

    protected _onLayerAdded(layer: TileMapLayerContainerContentType<T>): void {}

    protected _onLayerRemoved(layer: TileMapLayerContainerContentType<T>): void {}

    protected _onBeforeLayerAdded(layer: TileMapLayerContainerContentType<T>): TileMapLayerContainerContentType<T> {
        return layer;
    }

    private _addSortedLayer(layer: TileMapLayerContainerContentType<T>): void {
        if (!this._zIndexOrderedLayers) this._zIndexOrderedLayers = [];
        this._zIndexOrderedLayers.push(layer);
        this._zIndexOrderedLayers.sort((a, b) => (a.zindex ?? 0) - (b.zindex ?? 0)); // sort by zindex
    }

    private _removeSortedLayer(layer: TileMapLayerContainerContentType<T>): void {
        if (this._zIndexOrderedLayers) {
            const index = this._zIndexOrderedLayers.findIndex((l) => l === layer);
            if (index !== -1) {
                this._zIndexOrderedLayers.splice(index, 1);
            }
        }
    }
}
