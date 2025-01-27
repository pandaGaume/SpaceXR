import { IDemInfos } from "core/dem";
import { EventState } from "core/events";
import { IDisplay, ITile, ITileMapLayer, ITilePipelineLink, ITileView, TileMapLayerView } from "core/tiles";
import { Nullable } from "core/types";

export class DEMLayerView<T extends IDemInfos> extends TileMapLayerView<T> {
    public constructor(layer: ITileMapLayer<T>, display: Nullable<IDisplay>, source: ITileView) {
        super(layer, display, source);
    }

    protected _onLinked(link: ITilePipelineLink<ITile<T>>): void {
        super._onLinked(link);
        // we are forwarding the activ tile to the newly linked target.
        link.forwardAdded(Array.from(this._activTiles), new EventState(-1, false, this, this));
    }
}
