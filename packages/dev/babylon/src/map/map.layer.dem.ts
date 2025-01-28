import { IDisplay, ITileMapLayer, ITileView } from "core/tiles";
import { Nullable } from "core/types";
import { ElevationType, IMap3D } from "./map.interfaces";
import { Map3dLayerView } from "./map.layer.view";

export class ElevationLayerView extends Map3dLayerView<ElevationType> {
    public constructor(map: IMap3D, layer: ITileMapLayer<ElevationType>, display: Nullable<IDisplay>, source: ITileView) {
        super(map, layer, display, source);
        this._map = map;
    }
}
