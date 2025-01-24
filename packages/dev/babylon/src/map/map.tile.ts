import { ImageLayerContentType, ITileMetrics, Tile, TileContentType } from "core/tiles";
import { ITileWithMesh } from "./map.interfaces";
import { Nullable } from "core/types";
import { AbstractMesh } from "@babylonjs/core";

export class TileWithMesh<T extends ImageLayerContentType> extends Tile<T> implements ITileWithMesh<T> {
    // 3D related
    _surface: Nullable<AbstractMesh>;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<T> = null, metrics?: ITileMetrics) {
        super(x, y, levelOfDetail, data, metrics);
        this._surface = null;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }

    public set surface(s: Nullable<AbstractMesh>) {
        this._surface = s;
    }
}
