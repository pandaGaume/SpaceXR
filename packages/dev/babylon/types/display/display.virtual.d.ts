import { Matrix, Mesh, Scene, TransformNode, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { ICartesian3, ISize3 } from "core/geometry";
import { IPointerSource } from "core/map/inputs";
import { VirtualDisplayInputsSource } from "./display.inputs.scene";
export declare class VirtualDisplay extends Mesh {
    _worldTransform: TransformNode;
    _dimension: ISize3;
    _halfDimension: ISize3;
    _resolution: ISize3;
    _ppu: Vector3;
    _pointerSource: IPointerSource<VirtualDisplayInputsSource>;
    _inverseWorldMatrix?: Matrix;
    constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene);
    get pointerSource(): IPointerSource<VirtualDisplayInputsSource>;
    protected _buildVertexData(): VertexData;
    get context3D(): TransformNode;
    get resolution(): ISize3;
    get dimension(): ISize3;
    get pixelPerUnit(): ICartesian3;
    getInverseWorldMatrix(): Matrix;
    getPixelToRef(pickedCoordinates: Vector3, pixel?: Vector2): Vector2;
    getXYZWorldVectors(): Array<Vector3>;
    dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void;
}
