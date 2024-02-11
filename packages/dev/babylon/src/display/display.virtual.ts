import { Matrix, Mesh, Scene, TmpVectors, TransformNode, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { ICartesian3, ISize3, Size3 } from "core/geometry";
import { IPointerSource } from "core/map/inputs";

import { VirtualDisplayInputsSource } from "./display.inputs.scene";

export class VirtualDisplay extends Mesh {
    _worldTransform: TransformNode;

    _dimension: ISize3;
    _halfDimension: ISize3;
    _resolution: ISize3;
    _ppu: Vector3;
    _pointerSource: IPointerSource<VirtualDisplayInputsSource>;

    // cached
    _inverseWorldMatrix?: Matrix;

    public constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene) {
        super(name, scene);
        this._dimension = dimension;
        this._halfDimension = new Size3(dimension.width / 2, dimension.height / 2, dimension.thickness / 2);
        this._resolution = resolution;
        this._ppu = new Vector3(resolution.width / dimension.width, resolution.height / dimension.height, resolution.thickness / dimension.thickness);

        const data = this._buildVertexData();
        data.applyToMesh(this);
        this.scaling.x = this.scaling.y = -1;
        this._worldTransform = new TransformNode(`${name}_context`, scene);
        this._worldTransform.parent = this;
        this.isPickable = true; // enable pointer events
        this._pointerSource = new VirtualDisplayInputsSource(this);
    }

    public get pointerSource(): IPointerSource<VirtualDisplayInputsSource> {
        return this._pointerSource;
    }

    protected _buildVertexData(): VertexData {
        const data = new VertexData();
        const sx = this.dimension.width;
        const sy = this.dimension.height;

        data.positions = [-0.5 * sx, 0.5 * sy, 0, 0.5 * sx, 0.5 * sy, 0, 0.5 * sx, -0.5 * sy, 0, -0.5 * sx, -0.5 * sy, 0];
        data.indices = [2, 3, 0, 0, 1, 2];
        data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
        return data;
    }

    public get context3D(): TransformNode {
        return this._worldTransform;
    }

    public get resolution(): ISize3 {
        return this._resolution;
    }

    public get dimension(): ISize3 {
        return this._dimension;
    }

    public get pixelPerUnit(): ICartesian3 {
        return this._ppu;
    }

    public getInverseWorldMatrix(): Matrix {
        if (this.isWorldMatrixFrozen) {
            // fast track
            this._inverseWorldMatrix = this._inverseWorldMatrix || this.worldMatrixFromCache.invertToRef(this._inverseWorldMatrix || Matrix.Zero());
        } else {
            const cached = this.worldMatrixFromCache;
            const world = this.getWorldMatrix();
            if (!world.equals(cached) || !this._inverseWorldMatrix) {
                this._inverseWorldMatrix = world.invertToRef(this._inverseWorldMatrix || Matrix.Zero());
            }
        }
        return this._inverseWorldMatrix;
    }

    public getPixelToRef(pickedCoordinates: Vector3, pixel?: Vector2): Vector2 {
        const invWorld = this.getInverseWorldMatrix();
        const transformed = Vector3.TransformCoordinatesToRef(pickedCoordinates, invWorld, TmpVectors.Vector3[0]);
        pixel = pixel || Vector2.Zero();
        pixel.x = Math.round((this._halfDimension.width - transformed.x) * this._ppu.x);
        pixel.y = Math.round((this._halfDimension.height - transformed.y) * this._ppu.y);
        return pixel;
    }

    public getXYZWorldVectors(): Array<Vector3> {
        const transform = this.getWorldMatrix();
        const p = this.getAbsolutePosition();
        return [
            Vector3.TransformCoordinates(Vector3.Right(), transform).subtractInPlace(p),
            Vector3.TransformCoordinates(Vector3.Up(), transform).subtractInPlace(p),
            Vector3.TransformCoordinates(Vector3.Forward(), transform).subtractInPlace(p),
        ];
    }

    public dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
        this._worldTransform.dispose(doNotRecurse, disposeMaterialAndTextures);
    }
}
