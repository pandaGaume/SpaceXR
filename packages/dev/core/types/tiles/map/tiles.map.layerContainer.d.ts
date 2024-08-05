import { EventState, Observable } from "../../events";
import { IDisposable } from "../../types";
import { ValidableBase } from "../../validable";
import { ITileMapLayer, ITileMapLayerContainer, ITileMapLayerView } from "./tiles.map.interfaces";
export declare class TileMapLayerViewContainer<T, L extends ITileMapLayer<T>> extends ValidableBase implements ITileMapLayerContainer<T, L>, IDisposable {
    private _layerAddedObservable?;
    private _layerRemovedObservable?;
    protected _layers: Map<string, ITileMapLayerView<T, L>>;
    protected _zIndexOrderedLayers?: Array<ITileMapLayerView<T, L>>;
    constructor();
    get layerAddedObservable(): Observable<L>;
    get layerRemovedObservable(): Observable<L>;
    getLayers(predicate?: (k: string, l: L) => boolean, sorted?: boolean): IterableIterator<L>;
    getOrderedLayers(predicate?: (k: string, l: L) => boolean): IterableIterator<L>;
    addLayer(layer: L): void;
    protected _onLayerViewValidation(eventData: boolean, eventState: EventState): void;
    removeLayer(layer: L): void;
    clear(): void;
    dispose(): void;
    protected _onLayerAdded(layer: L): void;
    protected _onLayerRemoved(layer: L): void;
    protected _onLayerViewAdded(view: ITileMapLayerView<T, L>): void;
    protected _onLayerViewRemoved(view: ITileMapLayerView<T, L>): void;
    protected _buildLayerView(layer: L): ITileMapLayerView<T, L> | undefined;
    private _addSortedLayer;
    private _removeSortedLayer;
}
