import { IBounds } from "core/geometry";
import { ITile3D, ITile3DNode, Tile3dContent } from "./tile3d.interfaces";
import { Tile3DNode } from "./tile3d.node";

export class Tile3D<T> extends Tile3DNode implements ITile3D<T> {
    private _content: Tile3dContent<T>;

    public constructor(bounds?: IBounds, error: number = 0) {
        super(bounds, error);
        this._content = null;
    }

    public get content(): Tile3dContent<T> {
        return this._content;
    }

    public set content(content: Tile3dContent<T>) {
        this._content = content;
    }

    protected _constructor(): new (bounds?: IBounds, error?: number) => ITile3DNode {
        return Tile3D;
    }
}
