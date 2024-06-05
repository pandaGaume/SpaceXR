import { Matrix, Mesh, Scene, TmpVectors, TransformNode, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { ICartesian3, ISize2, ISize3, Size2, Size3 } from "core/geometry";

import { VirtualDisplayInputsSource } from "./display.inputs.scene";
import { Observable, PropertyChangedEventArgs } from "core/events";
import { ITileDisplayBounds } from "core/tiles";

export class VirtualDisplay extends Mesh implements ITileDisplayBounds {
    public static SD: ISize2 = new Size2(640, 480);
    public static QHD: ISize2 = new Size2(960, 540);
    public static HD: ISize2 = new Size2(1280, 720);
    public static WXGA: ISize2 = new Size2(1280, 800);
    public static FullHD: ISize2 = new Size2(1980, 1080);
    public static UltraHD: ISize2 = new Size2(3840, 2160);
    public static UltraHD_2: ISize2 = new Size2(7680, 4320);

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;

    _worldTransform: TransformNode;

    _dimension: ISize3;
    _halfDimension: ISize3;
    _resolution: ISize3;
    _ppu: Vector3;
    _ratio: Vector3;
    _pointerSource: VirtualDisplayInputsSource;

    // cached
    _inverseWorldMatrix?: Matrix;

    public constructor(name: string, dimension: ISize2, resolution: ISize2, scene?: Scene) {
        super(name, scene);
        this._dimension = Size3.FromSize(dimension);
        this._halfDimension = new Size3(this._dimension.width / 2, this._dimension.height / 2, this._dimension.thickness / 2);
        this._resolution = Size3.FromSize(resolution);
        this._ppu = new Vector3(
            this._resolution.width / this._dimension.width,
            this._resolution.height / this._dimension.height,
            this._dimension.thickness ? this._resolution.thickness / this._dimension.thickness : 0
        );
        this._ratio = new Vector3(this._ppu.x / this._ppu.y, this._ppu.z / this._ppu.y, this._ppu.z / this._ppu.x);
        const data = this._buildVertexData();
        data.applyToMesh(this);
        this._worldTransform = new TransformNode(`${name}_context`, scene);
        this._worldTransform.parent = this;
        this.isPickable = true; // enable pointer events
        this._pointerSource = new VirtualDisplayInputsSource(this);
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public get width(): number {
        return this._resolution.width;
    }

    public get height(): number {
        return this._resolution.height;
    }

    public get ratio(): number {
        return this.width / this.height;
    }

    public get pointerSource(): VirtualDisplayInputsSource {
        return this._pointerSource;
    }

    protected _buildVertexData(): VertexData {
        const data = new VertexData();
        const sx = this.dimension.width;
        const sy = this.dimension.height;

        data.positions = [0.5 * sx, 0.5 * sy, 0, -0.5 * sx, 0.5 * sy, 0, -0.5 * sx, -0.5 * sy, 0, 0.5 * sx, -0.5 * sy, 0];
        data.indices = [2, 0, 3, 0, 2, 1];
        data.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
        data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];

        return data;
    }

    public get context3d(): TransformNode {
        return this._worldTransform;
    }

    public get resolution(): ISize3 {
        return this._resolution;
    }

    public get dimension(): ISize3 {
        return this._dimension;
    }

    public get halfDimension(): ISize3 {
        return this._halfDimension;
    }

    public get pixelPerUnit(): ICartesian3 {
        return this._ppu;
    }

    public get aspectRatio(): ICartesian3 {
        return this._ratio;
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
