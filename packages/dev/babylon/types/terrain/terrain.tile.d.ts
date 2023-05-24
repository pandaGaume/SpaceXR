import { AbstractMesh } from "@babylonjs/core";
import { IEnvelope } from "core/geography";
import { IRectangle } from "core/geometry";
import { ITile, ITileAddress, ITileProxy } from "core/tiles/tiles.interfaces";
import { Nullable } from "core/types";
export declare class TerrainTile<V> implements ITile<V>, ITileProxy<V> {
    _delegate: ITile<V>;
    _mesh: AbstractMesh | undefined;
    constructor(delegate: ITile<V>, mesh?: AbstractMesh);
    get delegate(): ITile<V>;
    get mesh(): AbstractMesh | undefined;
    set mesh(v: AbstractMesh | undefined);
    get address(): ITileAddress;
    get content(): Nullable<V> | undefined;
    get rect(): IRectangle | undefined;
    get bounds(): IEnvelope | undefined;
    dispose(): TerrainTile<V>;
}
