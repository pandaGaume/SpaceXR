import { ISize3 } from "core/geometry/geometry.interfaces";
import { Matrix, Mesh, Scene, Vector2, Vector3 } from "@babylonjs/core";
export declare class VirtualDisplay extends Mesh {
    _dimension: ISize3;
    _halfDimension: ISize3;
    _resolution: ISize3;
    _ppu: Vector3;
    _invWorld?: Matrix;
    constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene);
    get resolution(): ISize3;
    get dimension(): ISize3;
    getInverseWorldMatrix(): Matrix;
    getPixelToRef(pickedCoordinates: Vector3, pixel?: Vector2): Vector2;
    getXYZWorldVectors(): Array<Vector3>;
}
