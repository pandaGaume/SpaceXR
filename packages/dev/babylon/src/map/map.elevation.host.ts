import { IDemInfos } from "core/dem";
import { ITileMapLayer, ITileView, TileMapLayerView } from "core/tiles";
import { IElevationGridFactory, IElevationHost } from "./map.elevation.interfaces";
import { ElevationGridFactory } from "./map.elevation.host.factory";
import { Mesh } from "@babylonjs/core";
import { IVerticesData } from "core/meshes";

/**
 * This class is in charge of building grid and instance.
 */
export class ElevationHost extends TileMapLayerView<IDemInfos> implements IElevationHost {
    // the grid model
    _factory: IElevationGridFactory;
    _grid: IVerticesData;
    _template: Mesh;

    public constructor(layer: ITileMapLayer<IDemInfos>, source?: ITileView) {
        super(layer, source);
        this._factory = new ElevationGridFactory();
        this._grid = this._factory.buildTopology(this.metrics.tileSize);
    }
}
