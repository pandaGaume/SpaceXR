import { IDemInfos } from "core/dem";
import { IDisplay, ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase } from "core/tiles";
import { ElevationMapContentType, IElevationHost, IElevationMap, IsElevationLayer } from "./map.elevation.interfaces";
import { ElevationHost } from "./map.elevation.host";
import { Nullable } from "@babylonjs/core";

export class ElevationMap extends TileMapBase<ElevationMapContentType> implements IElevationMap {
    public constructor(display?: Nullable<IDisplay>, nav?: Nullable<ITileNavigationState>) {
        super(display, nav);
    }

    /**
     * This is where we create different views, depending the type of layer.
     * Elevation type layer will create specific view, which hold the necessary mechanism to create grid instances
     * @param layer
     * @returns the layer view created
     */
    protected _createLayerView(layer: ITileMapLayer<ElevationMapContentType>): ITileMapLayerView<ElevationMapContentType> {
        if (IsElevationLayer(layer)) {
            const host = this._createElevationHost(layer);
            return host;
        }
        return super._createLayerView(layer);
    }

    protected _createElevationHost(layer: ITileMapLayer<IDemInfos>): IElevationHost {
        return new ElevationHost(layer, this._display, this._navigation, this._view);
    }
}
