import { Matrix, Mesh, Scene, TransformNode, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { ICartesian3, ISize2 } from "core/geometry";
import { VirtualDisplayInputsSource } from "./display.inputs.scene";
export declare class VirtualDisplay extends Mesh {
    _worldTransform: TransformNode;
    _dimension: ISize2;
    _halfDimension: ISize2;
    _resolution: ISize2;
    _ppu: Vector3;
    _pointerSource: VirtualDisplayInputsSource;
    _inverseWorldMatrix?: Matrix;
    constructor(name: string, dimension: ISize2, resolution: ISize2, scene?: Scene);
    get pointerSource(): VirtualDisplayInputsSource;
    protected _buildVertexData(): VertexData;
    get context3D(): TransformNode;
    get resolution(): ISize2;
    get dimension(): ISize2;
    get pixelPerUnit(): ICartesian3;
    getInverseWorldMatrix(): Matrix;
    getPixelToRef(pickedCoordinates: Vector3, pixel?: Vector2): Vector2;
    getXYZWorldVectors(): Array<Vector3>;
    dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void;
}
