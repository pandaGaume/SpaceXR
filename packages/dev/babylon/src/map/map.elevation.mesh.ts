import { AbstractMesh } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ITile } from "core/tiles";
import { IValidable, Nullable, isValidable } from "core/types";
import { ElevationTexture } from "./map.elevation.texture";
import { ValidableBase } from "core/validable";

export interface IElevationMesh extends IValidable {
    // the mesh used to display the elevation ()
    surface: AbstractMesh;
    // the texture used to display onto the elevation mesh
    textureSource: Nullable<ElevationTexture>;
    tile: ITile<IDemInfos>;
}

export interface IElevationTile extends ITile<IElevationMesh> {}

export class ElevationMesh extends ValidableBase implements IElevationMesh {
    // elevations related
    _surface: AbstractMesh;

    // texture related
    _tile: ITile<IDemInfos>;
    _texture: Nullable<ElevationTexture>;

    public constructor(tile: ITile<IDemInfos>, surface: AbstractMesh) {
        super();
        this._texture = null;
        this._surface = surface;
        this._tile = tile;
    }

    public get surface(): AbstractMesh {
        return this._surface;
    }

    public get tile(): ITile<IDemInfos> {
        return this._tile;
    }

    public get textureSource(): Nullable<ElevationTexture> {
        return this._texture;
    }

    protected _doValidate(): void {
        const t = this._texture;
        if (isValidable(t)) {
            t.validate();
        }
    }
}
