import { ITile, ITileMetrics } from "../tiles.interfaces";
import { AbstractTileProvider } from "./tiles.provider";
import { IPipelineMessageType, ITileMapLayer } from "../../tiles";
import { EventState } from "../../events";
export declare class BlendProvider extends AbstractTileProvider<HTMLImageElement> {
    _layer: ITileMapLayer<HTMLImageElement>;
    constructor(namespace: string, metrics: ITileMetrics, layer: ITileMapLayer<HTMLImageElement>);
    _fetchContent(tile: ITile<HTMLImageElement>, callback: (t: ITile<HTMLImageElement>) => void): ITile<HTMLImageElement>;
    protected _onTileAdded(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState): void;
    protected _onTileRemoved(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState): void;
    protected _onTileUpdated(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState): void;
}
