import { ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase } from "core/tiles";
import { IMap3D, Map3DContentType } from "./map.interfaces";
import { TransformNode } from "@babylonjs/core";
import { Nullable } from "core/types";
import { EventState, PropertyChangedEventArgs } from "core/events";
export declare class Map3D extends TileMapBase<Map3DContentType> implements IMap3D {
    static DefaultLodElevationShift: number;
    static ROOT_SUFFIX: string;
    _root: TransformNode;
    constructor(root: TransformNode);
    get name(): string;
    protected _buildLayerView(layer: ITileMapLayer<Map3DContentType>): Nullable<ITileMapLayerView<any>>;
    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void;
    protected _rotateMap(nav: Nullable<ITileNavigationState>): void;
    protected _onNavigationBinded(nav: Nullable<ITileNavigationState>): void;
    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<Map3DContentType>>, eventState: EventState): void;
    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<Map3DContentType>>, eventState: EventState): void;
}
