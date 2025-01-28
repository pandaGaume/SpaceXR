import { ITileMetrics, Tile, TileContentType } from "core/tiles";
import { ITileWithGridElevation } from "./map.interfaces";
import { Nullable } from "core/types";
import { AbstractMesh } from "@babylonjs/core";
import { ISize2 } from "core/geometry";

export class TileWithElevation<T> extends Tile<T> implements ITileWithGridElevation<T> {
    // 3D related
    _surface: Nullable<AbstractMesh>;
    _gridSize: Nullable<ISize2>;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<T> = null, metrics?: ITileMetrics) {
        super(x, y, levelOfDetail, data, metrics);
        this._surface = null;
        this._gridSize = null;
    }

    public get gridSize(): Nullable<ISize2> {
        return this._gridSize;
    }

    public set gridSize(v: Nullable<ISize2>) {
        this._gridSize = v;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }

    public set surface(s: Nullable<AbstractMesh>) {
        this._surface = s;
    }
}
