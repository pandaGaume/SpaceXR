import { AbstractMesh } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ITileMetrics, Tile, TileContentType } from "core/tiles";
import { Nullable } from "core/types";
import { ElevationTexture } from "../../materials";
import { IElevationTile } from "./map.elevation.interfaces";

export class ElevationTile extends Tile<IDemInfos> implements IElevationTile {
    // 3D related
    _surface: Nullable<AbstractMesh>;
    // Elevation related
    _texture: Nullable<ElevationTexture>;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<IDemInfos> = null, metrics?: ITileMetrics) {
        super(x, y, levelOfDetail, data, metrics);
        this._surface = null;
        this._texture = null;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }

    public set surface(s: Nullable<AbstractMesh>) {
        this._surface = s;
    }

    public get textureSource(): Nullable<ElevationTexture> {
        return this._texture;
    }

    public set textureSource(t: Nullable<ElevationTexture>) {
        this._texture = t;
    }
}
