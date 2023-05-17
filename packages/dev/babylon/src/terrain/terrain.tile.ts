import { AbstractMesh } from "@babylonjs/core";
import { ITile, ITileAddress, ITileProxy } from "@dev/core/src/tiles/tiles.interfaces";
import { Nullable, IRectangle, IEnvelope } from "dev/core/src";

export class TerrainTile<V> implements ITile<V>, ITileProxy<V> {
    _delegate: ITile<V>;
    _mesh: AbstractMesh | undefined;

    public constructor(delegate: ITile<V>, mesh?: AbstractMesh) {
        this._delegate = delegate;
        this._mesh = mesh;
    }
    public get delegate(): ITile<V> {
        return this._delegate;
    }
    public get mesh(): AbstractMesh | undefined {
        return this._mesh;
    }
    public set mesh(v: AbstractMesh | undefined) {
        this._mesh = v;
    }

    public get address(): ITileAddress {
        return this._delegate.address;
    }
    public get content(): Nullable<V> | undefined {
        return this._delegate.content;
    }
    public get rect(): IRectangle | undefined {
        return this._delegate.rect;
    }
    public get bounds(): IEnvelope | undefined {
        return this._delegate.bounds;
    }

    public dispose(): TerrainTile<V> {
        this._mesh?.dispose();
        this._mesh = undefined;
        return this;
    }
}
