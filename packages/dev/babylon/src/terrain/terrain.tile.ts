import { AbstractMesh } from "@babylonjs/core";
import { IEnvelope } from "core/geography";
import { IRectangle } from "core/geometry";
import { ITile, ITileAddress, ITileProxy, TileContent } from "core/tiles/tiles.interfaces";

export class TerrainTile<V> implements ITile<V>, ITileProxy<V> {
    _delegate: ITile<V>;
    _surface: AbstractMesh | undefined;

    public constructor(delegate: ITile<V>, mesh?: AbstractMesh) {
        this._delegate = delegate;
        this._surface = mesh;
    }
    public get delegate(): ITile<V> {
        return this._delegate;
    }
    public get surface(): AbstractMesh | undefined {
        return this._surface;
    }
    public set surface(v: AbstractMesh | undefined) {
        this._surface = v;
    }
    public get address(): ITileAddress {
        return this._delegate.address;
    }
    public get key(): string {
        return this._delegate.key;
    }
    public get content(): TileContent<V>  {
        return this._delegate.content;
    }
    public get rect(): IRectangle | undefined {
        return this._delegate.rect;
    }
    public get bounds(): IEnvelope | undefined {
        return this._delegate.bounds;
    }
    public dispose(): TerrainTile<V> {
        this._surface?.dispose();
        this._surface = undefined;
        return this;
    }
}
