import { IDemInfos } from "core/dem";
import { EventState } from "core/events";
import { ITileMapLayer, ITileMapLayerView, TileMapBase } from "core/tiles";
import { ElevationLayer } from "./map.elevation.layer";
import { ElevationMapContentType, IElevationHost } from "./map.elevation.interfaces";
import { ElevationHost } from "./map.elevation.host";

/**
 * this is internal ype guard to test if the layer is usable as Elevation layer
 * @param b thhe object to be tested
 * @returns the object casted as ITileMapLayer<IDemInfos>
 */
function IsElevationLayer(b: unknown): b is ITileMapLayer<IDemInfos> {
    if (typeof b !== "object" || b === null) return false;
    return b instanceof ElevationLayer;
}

export class ElevationMap extends TileMapBase<ElevationMapContentType> {
    protected _onLayerAdded(eventData: Array<ITileMapLayer<ElevationMapContentType>>, eventstate: EventState): void {
        super._onLayerAdded(eventData, eventstate);
    }

    protected _onLayerRemoved(eventData: Array<ITileMapLayer<ElevationMapContentType>>, eventstate: EventState): void {
        super._onLayerRemoved(eventData, eventstate);
    }

    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventstate: EventState): void {
        super._onLayerViewAdded(eventData, eventstate);
    }

    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventstate: EventState): void {
        super._onLayerViewRemoved(eventData, eventstate);
    }

    /**
     * This is where we create different views, depending the type of layer.
     * Elevation type layer will create specific view, which hold the necessary mechanism to create grid instances
     * @param layer
     * @returns the layer view created
     */
    protected _createLayerView(layer: ITileMapLayer<ElevationMapContentType>): ITileMapLayerView<ElevationMapContentType> {
        if (IsElevationLayer(layer)) {
            return this._createElevationHost(layer);
        }
        return super._createLayerView(layer);
    }

    protected _createElevationHost(layer: ITileMapLayer<IDemInfos>): IElevationHost {
        const host = new ElevationHost(layer, this._view);
        return host;
    }
}
