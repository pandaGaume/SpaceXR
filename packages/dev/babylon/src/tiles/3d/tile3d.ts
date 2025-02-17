import { IBounds } from "core/geometry";
import { ITile3D, RefinementStrategy, Tile3dContent } from "./tile3d.interfaces";
import { Tile3DNode } from "./tile3d.node";
import { SubdivisionScheme } from "core/tree/tree.spatial.interfaces";

export class Tile3D<T> extends Tile3DNode implements ITile3D<T> {
    private _content: Tile3dContent<T>;

    public constructor(bounds?: IBounds, error: number = 0) {
        super(bounds, error);
        this._content = null;
    }

    public get content(): Tile3dContent<T> {
        return this._content;
    }

    public split(sub: SubdivisionScheme.QUADTREE, refinementStrategy?: RefinementStrategy): void {
        this._children = Tile3DNode.Split(this, sub, refinementStrategy ?? this.refinementStrategy, Tile3D);
    }
}
