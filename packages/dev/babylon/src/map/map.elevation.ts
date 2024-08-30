import { IDemInfos } from "core/dem";
import { EventState } from "core/events";
import { ITileMapLayer, ITileMapLayerView, TileMapBase } from "core/tiles";

export type ElevationMapContentType = IDemInfos;

export class ElevationMap extends TileMapBase<ElevationMapContentType> {
    protected _onLayerAdded(eventData: Array<ITileMapLayer<ElevationMapContentType>>, eventstate: EventState): void {
        super._onLayerAdded(eventData, eventstate);
    }

    protected _onLayerRemoved(eventData: Array<ITileMapLayer<ElevationMapContentType>>, eventstate: EventState): void {
        super._onLayerRemoved(eventData, eventstate);
    }

    /**
     * This is where we create different views, depending the type of layer.
     * Elevation type layer will create specific view, which hold the necessary mechanism to create grid instances
     * @param layer
     * @returns the layer view created
     */
    protected _createLayerView(layer: ITileMapLayer<ElevationMapContentType>): ITileMapLayerView<ElevationMapContentType> {
        return super._createLayerView(layer);
    }
}
