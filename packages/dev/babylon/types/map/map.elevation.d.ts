import { IDemInfos } from "core/dem";
import { IDisplay, ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase } from "core/tiles";
import { ElevationMapContentType, IElevationHost, IElevationMap } from "./map.elevation.interfaces";
import { Nullable, TransformNode } from "@babylonjs/core";
import { EventState, PropertyChangedEventArgs } from "core/events";
export declare class ElevationMap extends TileMapBase<ElevationMapContentType> implements IElevationMap {
    _root: TransformNode;
    constructor(root: TransformNode, display?: Nullable<IDisplay>, nav?: Nullable<ITileNavigationState>);
    protected _createLayerView(layer: ITileMapLayer<ElevationMapContentType>): ITileMapLayerView<ElevationMapContentType>;
    protected _createElevationHost(layer: ITileMapLayer<IDemInfos>): IElevationHost;
    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void;
    protected _rotateMap(nav: Nullable<ITileNavigationState>): void;
    protected _onNavigationBinded(nav: Nullable<ITileNavigationState>): void;
    protected _onDisplayBinded(display: Nullable<IDisplay>): void;
    protected _onDisplayResized(display: IDisplay): void;
    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventState: EventState): void;
    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventState: EventState): void;
}
