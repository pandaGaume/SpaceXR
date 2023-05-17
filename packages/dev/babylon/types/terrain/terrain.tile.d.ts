import { AbstractMesh } from "@babylonjs/core";
import { ITile, ITileAddress, ITileProxy } from "@dev/core/src/tiles/tiles.interfaces";
import { Nullable, IRectangle, IEnvelope } from "dev/core/src";
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
