import { ITile3D, Tile3dContent } from "./tile3d.interfaces";
import { Tile3DNode } from "./tile3d.node";

export class Tile3D<T> extends Tile3DNode implements ITile3D<T> {
    private _content: Tile3dContent<T>;

    public constructor() {
        super();
        this._content = null;
    }

    public get content(): Tile3dContent<T> {
        return this._content;
    }
}
