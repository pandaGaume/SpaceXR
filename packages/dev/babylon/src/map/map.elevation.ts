import { IDemInfos } from "core/dem";
import { IPipelineMessageType, ITile, ITileDisplay, ITileMapLayer, ITileMapLayerContainer, ImageLayer, TileMapBase, TileMapLayerContainer } from "core/tiles";
import { ElevationLayer } from "./map.elevation.layer";
import { EventState, Observer } from "core/events";
import { Nullable } from "core/types";

// we use type of IDemInfos for elevation and rgb images for the texture.
export type ElevationTileContentType = IDemInfos | HTMLImageElement;

class ElevationContainer extends TileMapLayerContainer<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>> {
    updatedObserver?: Nullable<Observer<IPipelineMessageType<ITile<ElevationTileContentType>>>>;
    removedObserver?: Nullable<Observer<IPipelineMessageType<ITile<ElevationTileContentType>>>>;
    addedObserver?: Nullable<Observer<IPipelineMessageType<ITile<ElevationTileContentType>>>>;

    public constructor(layer: ITileMapLayer<ElevationTileContentType>) {
        super(layer);
    }

    public clear(): void {
        super.clear();
        this.updatedObserver?.disconnect();
        this.updatedObserver = null;
        this.removedObserver?.disconnect();
        this.removedObserver = null;
        this.addedObserver?.disconnect();
        this.addedObserver = null;
    }
}

export class ElevationMap extends TileMapBase<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>> {
    public constructor(name: string, display?: ITileDisplay) {
        super(name, display);
    }

    public get elevationLayer(): Array<ElevationLayer> {
        return this._getTypedLayer(ElevationLayer);
    }

    public get textureLayer(): Array<ImageLayer> {
        return this._getTypedLayer(ImageLayer);
    }

    protected _getTypedLayer<T>(type: new (...args: any[]) => T): Array<T> {
        const a: Array<T> = [];
        for (const l of this.getOrderedLayers((l) => l instanceof type)) {
            a.push(l as T);
        }
        return a;
    }

    // we need to override this method to handle the different types of layers container.
    // we need to add observers in cache.
    protected _buildLayerContainer(layer: ITileMapLayer<ElevationTileContentType>): ITileMapLayerContainer<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>> {
        return new ElevationContainer(layer);
    }

    protected _onLayerAdded(container: ElevationContainer): void {
        const layer = container.layer;
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerAdded(container);
        } else if (layer instanceof ImageLayer) {
            this._onTextureLayerAdded(container);
        }
    }

    protected _onLayerRemoved(container: ElevationContainer): void {
        const layer = container.layer;
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerRemoved(container);
        } else if (layer instanceof ImageLayer) {
            this._onTextureLayerRemoved(container);
        }
    }

    protected _onElevationLayerAdded(container: ElevationContainer): void {
        const layer = container.layer;
        container.addedObserver = layer.addedObservable.add(this._onElevationAdded.bind(this));
        container.removedObserver = layer.removedObservable.add(this._onElevationRemoved.bind(this));
        container.updatedObserver = layer.updatedObservable.add(this._onElevationUpdated.bind(this));
    }

    protected _onElevationLayerRemoved(container: ElevationContainer): void {
        container.clear();
    }

    protected _onTextureLayerAdded(container: ElevationContainer): void {
        const layer = container.layer;
        container.addedObserver = layer.addedObservable.add(this._onTextureAdded.bind(this));
        container.removedObserver = layer.removedObservable.add(this._onTextureRemoved.bind(this));
        container.updatedObserver = layer.updatedObservable.add(this._onTextureUpdated.bind(this));
    }

    protected _onTextureLayerRemoved(container: ElevationContainer): void {
        container.clear();
    }

    protected _onElevationAdded(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        // when a elevation tile is added, we need to create a mesh for it.
    }
    protected _onElevationRemoved(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        // when a elevation tile is removed, we need to remove the corresponding mesh from the scene.
    }
    protected _onElevationUpdated(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        // when a elevation tile is updated, we need to update the corresponding mesh.
    }

    protected _onTextureAdded(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        // when a texture tile is added, we need to see if the layer is an active one and then update the material or instance buffer of the corresponding mesh
        // this implies that wee need to find the mesh corresponding to the tile.
    }

    protected _onTextureRemoved(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {}
    protected _onTextureUpdated(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {}
}
