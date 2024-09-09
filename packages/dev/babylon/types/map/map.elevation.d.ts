import { IDemInfos } from "core/dem";
import { IDisplay, ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase } from "core/tiles";
import { ElevationMapContentType, IElevationHost, IElevationMap } from "./map.elevation.interfaces";
import { Nullable } from "@babylonjs/core";
export declare class ElevationMap extends TileMapBase<ElevationMapContentType> implements IElevationMap {
    constructor(display?: Nullable<IDisplay>, nav?: Nullable<ITileNavigationState>);
    protected _createLayerView(layer: ITileMapLayer<ElevationMapContentType>): ITileMapLayerView<ElevationMapContentType>;
    protected _createElevationHost(layer: ITileMapLayer<IDemInfos>): IElevationHost;
}
