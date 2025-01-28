import { IDemInfos } from "core/dem";
import { IDisplay, ITileMapLayer, ITileView } from "core/tiles";
import { Nullable } from "core/types";
import { IMap3D } from "./map.interfaces";
import { Map3dLayerView } from "./map.layer.view";

export class DEMLayerView<T extends IDemInfos> extends Map3dLayerView<T> {
    public constructor(map: IMap3D, layer: ITileMapLayer<T>, display: Nullable<IDisplay>, source: ITileView) {
        super(map, layer, display, source);
        this._map = map;
    }
}
