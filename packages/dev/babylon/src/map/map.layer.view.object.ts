import { IDisplay, ITileMapLayer, ITileView } from "core/tiles";
import { Nullable } from "core/types";
import { IMap3D, Object3dType } from "./map.interfaces";
import { Map3dLayerView } from "./map.layer.view";

export class Tile3dLayerView extends Map3dLayerView<Object3dType> {
    public constructor(map: IMap3D, layer: ITileMapLayer<Object3dType>, display: Nullable<IDisplay>, source: ITileView) {
        super(map, layer, display, source);
        this._map = map;
    }
}
