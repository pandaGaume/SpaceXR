import { StandardMaterial, Scene, Nullable } from "@babylonjs/core";
import { IMap3dMaterial, ITileMapLayerViewWithElevation, ITileWithElevation } from "../map/map.interfaces";
import { Cartesian3, ICartesian3, ISize3, Size3 } from "core/geometry";
import { IHolographicBounds } from "../display";

export class Map3dMaterial extends StandardMaterial implements IMap3dMaterial {
    public constructor(name: string, scene?: Scene) {
        super(name, scene);
        this.wireframe = true;
    }

    public holographicBounds: Nullable<IHolographicBounds> = null;
    public mapScale: ICartesian3 = Cartesian3.One();
    public displayResolution: ISize3 = Size3.Zero();

    public addTile(tiles: ITileWithElevation, source: ITileMapLayerViewWithElevation): void {}
    public removeTile(tiles: ITileWithElevation, source: ITileMapLayerViewWithElevation): void {}
    public updateTile(tiles: ITileWithElevation, source: ITileMapLayerViewWithElevation): void {}
}
