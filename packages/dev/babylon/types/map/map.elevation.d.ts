import { IDemInfos } from "core/dem";
import { IPipelineMessageType, ITile, ITileDisplay, ITileMapLayer, ITileMapLayerContainer, ImageLayer, TileMapBase, TileMapLayerContainer } from "core/tiles";
import { ElevationLayer } from "./map.elevation.layer";
import { EventState, Observer } from "core/events";
import { Nullable } from "core/types";
export type ElevationTileContentType = IDemInfos | HTMLImageElement;
declare class ElevationContainer extends TileMapLayerContainer<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>> {
    updatedObserver?: Nullable<Observer<IPipelineMessageType<ITile<ElevationTileContentType>>>>;
    removedObserver?: Nullable<Observer<IPipelineMessageType<ITile<ElevationTileContentType>>>>;
    addedObserver?: Nullable<Observer<IPipelineMessageType<ITile<ElevationTileContentType>>>>;
    constructor(layer: ITileMapLayer<ElevationTileContentType>);
    clear(): void;
}
export declare class ElevationMap extends TileMapBase<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>> {
    constructor(name: string, display?: ITileDisplay);
    get elevationLayer(): Array<ElevationLayer>;
    get textureLayer(): Array<ImageLayer>;
    protected _getTypedLayer<T>(type: new (...args: any[]) => T): Array<T>;
    protected _buildLayerContainer(layer: ITileMapLayer<ElevationTileContentType>): ITileMapLayerContainer<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>>;
    protected _onLayerAdded(container: ElevationContainer): void;
    protected _onLayerRemoved(container: ElevationContainer): void;
    protected _onElevationLayerAdded(container: ElevationContainer): void;
    protected _onElevationLayerRemoved(container: ElevationContainer): void;
    protected _onTextureLayerAdded(container: ElevationContainer): void;
    protected _onTextureLayerRemoved(container: ElevationContainer): void;
    protected _onElevationAdded(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void;
    protected _onElevationRemoved(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void;
    protected _onElevationUpdated(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void;
    protected _onTextureAdded(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void;
    protected _onTextureRemoved(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void;
    protected _onTextureUpdated(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void;
}
export {};
