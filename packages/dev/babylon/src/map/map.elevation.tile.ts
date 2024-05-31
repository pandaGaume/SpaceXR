import { AbstractMesh, Nullable } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { Tile } from "core/tiles";

export interface IElevationMesh extends IDemInfos {
    surface: Nullable<AbstractMesh>;
}

/// <summary>
/// A tile for elevation data. The tile serve as host for elevation data and therefore the instanced mesh used to display the elevation.
/// </summary>
export class ElevationTile extends Tile<IElevationMesh> {
    _surface: Nullable<AbstractMesh>; // may be a mesh or an instance.
    public constructor(x: number, y: number, levelOfDetail: number, data: IElevationMesh) {
        super(x, y, levelOfDetail, data);
        this._surface = null;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }

    public set surface(mesh: Nullable<AbstractMesh>) {
        this._surface = mesh;
    }
}
