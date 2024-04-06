import { ITile, ITileMetrics } from "../tiles.interfaces";
import { AbstractTileProvider } from "./tiles.provider";
import { IImageTileMapLayer, IPipelineMessageType } from "../../tiles";
import { EventState, Observer } from "../../events";
import { ICanvasRenderingContext } from "../../engine";
import { Nullable } from "../../types";
export declare class BlendProvider extends AbstractTileProvider<ImageData> {
    private static CreateCanvas;
    _layer: IImageTileMapLayer;
    _canvas?: HTMLCanvasElement;
    _internalCtx?: ICanvasRenderingContext;
    _observers: Array<Nullable<Observer<IPipelineMessageType<ITile<HTMLImageElement>>>>>;
    constructor(namespace: string, metrics: ITileMetrics, layer: IImageTileMapLayer);
    _fetchContent(tile: ITile<ImageData>, callback?: (t: ITile<ImageData>) => void): ITile<ImageData>;
    dispose(): void;
    protected _onTilesAdded(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState): void;
    protected _onTilesRemoved(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState): void;
    protected _onTilesUpdated(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState): void;
    private _getContext;
}
