import { AbstractMesh } from "@babylonjs/core";
import { IBounds } from "core/geometry";
import { Tile3D } from "../tile3d";
import { ITile3DNode } from "../tile3d.interfaces";

export class Tile3DAbstractMesh extends Tile3D<AbstractMesh> {
    public constructor(bounds?: IBounds, error: number = 0) {
        super(bounds, error);
    }

    protected _constructor(): new (bounds?: IBounds, error?: number) => ITile3DNode {
        return Tile3DAbstractMesh;
    }
}
