import { IDisplay, ITileMapLayer, ITileView, TileMapLayerView } from "core/tiles";
import { Nullable } from "core/types";
import { IMap3D } from "./map.interfaces";

export class Map3dLayerView<T> extends TileMapLayerView<T> {
    // the owner
    _map: IMap3D;

    public constructor(map: IMap3D, layer: ITileMapLayer<T>, display: Nullable<IDisplay>, source: ITileView) {
        super(layer, display, source);
        this._map = map;
    }

    public get map(): IMap3D {
        return this._map;
    }
}
