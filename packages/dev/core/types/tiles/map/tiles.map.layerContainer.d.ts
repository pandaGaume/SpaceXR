import { Observable } from "../../events";
import { ITileMapLayer, ITileMapLayerContainer } from "./tiles.map.interfaces";
export declare class LayerContainer<T, L extends ITileMapLayer<T>> implements ITileMapLayerContainer<T, L> {
    _layerAddedObservable?: Observable<L>;
    _layerRemovedObservable?: Observable<L>;
    protected _layers?: Array<L>;
    protected _zIndexOrderedLayers?: Array<L>;
    get layerAddedObservable(): Observable<L>;
    get layerRemovedObservable(): Observable<L>;
    getLayers(predicate?: (l: L) => boolean, sorted?: boolean): IterableIterator<L>;
    getOrderedLayers(predicate?: (l: L) => boolean): IterableIterator<L>;
    addLayer(layer: L): void;
    removeLayer(layer: L): void;
    private _addSortedLayer;
    private _removeSortedLayer;
    protected _onLayerAdded(layer: L): void;
    protected _onLayerRemoved(layer: L): void;
}
