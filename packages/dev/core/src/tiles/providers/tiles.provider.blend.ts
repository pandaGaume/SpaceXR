import { ITile, ITileMetrics } from "../tiles.interfaces";
import { AbstractTileProvider } from "./tiles.provider";
import { IPipelineMessageType, ITileMapLayer } from "../../tiles";
import { EventState } from "../../events";

export class BlendProvider extends AbstractTileProvider<HTMLImageElement> {
    _layer: ITileMapLayer<HTMLImageElement>;

    public constructor(namespace: string, metrics: ITileMetrics, layer: ITileMapLayer<HTMLImageElement>) {
        super();
        this.factory.withNamespace(namespace).withMetrics(metrics);
        this._layer = layer;
        this._layer.addedObservable.add(this._onTileAdded.bind(this));
        this._layer.removedObservable.add(this._onTileRemoved.bind(this));
        this._layer.updatedObservable.add(this._onTileUpdated.bind(this));
    }

    public _fetchContent(tile: ITile<HTMLImageElement>, callback: (t: ITile<HTMLImageElement>) => void): ITile<HTMLImageElement> {
        // get the tile from the layer.
        const tiles = Array.from(this._layer.activTiles.intersect(tile.bounds));

        if (tiles.length === 0) {
            return tile;
        }
        return tile;
    }

    protected _onTileAdded(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState) {}
    protected _onTileRemoved(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState) {}
    protected _onTileUpdated(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, state: EventState) {}
}
