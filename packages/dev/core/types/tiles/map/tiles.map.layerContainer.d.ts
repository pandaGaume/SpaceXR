import { Observable } from "../../events";
import { IDisposable } from "../../types";
import { ValidableBase } from "../../validable";
import { ITileMapLayerContainer, TileMapLayerContainerContentType } from "./tiles.map.interfaces";
export declare class TileMapLayerContainer<T> extends ValidableBase implements ITileMapLayerContainer<T>, IDisposable {
    private _layerAddedObservable?;
    private _layerRemovedObservable?;
    protected _layers: Map<string, TileMapLayerContainerContentType<T>>;
    protected _zIndexOrderedLayers?: Array<TileMapLayerContainerContentType<T>>;
    constructor();
    get layerAddedObservable(): Observable<TileMapLayerContainerContentType<T>>;
    get layerRemovedObservable(): Observable<TileMapLayerContainerContentType<T>>;
    getLayers(predicate?: (k: string, l: TileMapLayerContainerContentType<T>) => boolean, sorted?: boolean): IterableIterator<TileMapLayerContainerContentType<T>>;
    getOrderedLayers(predicate?: (k: string, l: TileMapLayerContainerContentType<T>) => boolean): IterableIterator<TileMapLayerContainerContentType<T>>;
    addLayer(layer: TileMapLayerContainerContentType<T>): void;
    removeLayer(layer: TileMapLayerContainerContentType<T>): void;
    clear(): void;
    dispose(): void;
    protected _onLayerAdded(layer: TileMapLayerContainerContentType<T>): void;
    protected _onLayerRemoved(layer: TileMapLayerContainerContentType<T>): void;
    protected _onBeforeLayerAdded(layer: TileMapLayerContainerContentType<T>): TileMapLayerContainerContentType<T>;
    private _addSortedLayer;
    private _removeSortedLayer;
}
