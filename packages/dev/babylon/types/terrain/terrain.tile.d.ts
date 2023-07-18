import { AbstractMesh } from "@babylonjs/core";
import { IEnvelope } from "core/geography";
import { IRectangle } from "core/geometry";
import { ITile, ITileAddress, ITileProxy, TileContent } from "core/tiles/tiles.interfaces";
export declare class TerrainTile<V> implements ITile<V>, ITileProxy<V> {
    _delegate: ITile<V>;
    _surface: AbstractMesh | undefined;
    constructor(delegate: ITile<V>, mesh?: AbstractMesh);
    get delegate(): ITile<V>;
    get surface(): AbstractMesh | undefined;
    set surface(v: AbstractMesh | undefined);
    get address(): ITileAddress;
    get key(): string;
    get content(): TileContent<V> | undefined;
    get rect(): IRectangle | undefined;
    get bounds(): IEnvelope | undefined;
    dispose(): TerrainTile<V>;
}
