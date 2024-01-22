import { Matrix, Mesh, Scene, TmpVectors, TransformNode, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { ICartesian2, ICartesian3, ISize3, Size3 } from "core/geometry";
import { ICartesian2WithInfos, IPointerSource } from "core/map/inputs";
import { Observable } from "core/events";

export class VirtualDisplay extends Mesh implements IPointerSource<VirtualDisplay> {
    _onPointerMoveObservable?: Observable<ICartesian2>;
    _onPointerOutObservable?: Observable<VirtualDisplay>;
    _onPointerDownObservable?: Observable<ICartesian2WithInfos>;
    _onPointerUpObservable?: Observable<ICartesian2WithInfos>;
    _onPointerClickObservable?: Observable<ICartesian2WithInfos>;
    _onPointerEnterObservable?: Observable<VirtualDisplay>;
    _onWheelObservable?: Observable<number>;

    _worldTransform: TransformNode;

    _dimension: ISize3;
    _halfDimension: ISize3;
    _resolution: ISize3;
    _ppu: Vector3;

    // cached
    _inverseWorldMatrix?: Matrix;

    public constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene) {
        super(name, scene);
        this._dimension = dimension;
        this._halfDimension = new Size3(dimension.width / 2, dimension.height / 2, dimension.thickness / 2);
        this._resolution = resolution;
        this._ppu = new Vector3(resolution.width / dimension.width, resolution.height / dimension.height, resolution.thickness / dimension.thickness);

        const data = new VertexData();
        const sx = this.dimension.width;
        const sy = this.dimension.height;

        data.positions = [-0.5 * sx, 0.5 * sy, 0, 0.5 * sx, 0.5 * sy, 0, 0.5 * sx, -0.5 * sy, 0, -0.5 * sx, -0.5 * sy, 0];
        data.indices = [2, 3, 0, 0, 1, 2];
        data.applyToMesh(this);
        this.scaling.x = this.scaling.y = -1;
        this._worldTransform = new TransformNode(`${name}_context`, scene);
        this._worldTransform.parent = this;
        this._setupPointers(this.getScene());
    }

    public get onPointerMoveObservable(): Observable<ICartesian2> {
        if (!this._onPointerMoveObservable) {
            this._onPointerMoveObservable = new Observable<ICartesian2>();
        }
        return this._onPointerMoveObservable;
    }

    public get onPointerOutObservable(): Observable<VirtualDisplay> {
        if (!this._onPointerOutObservable) {
            this._onPointerOutObservable = new Observable<VirtualDisplay>();
        }
        return this._onPointerOutObservable;
    }

    public get onPointerDownObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerDownObservable) {
            this._onPointerDownObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerDownObservable;
    }

    public get onPointerUpObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerUpObservable) {
            this._onPointerUpObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerUpObservable;
    }

    public get onPointerClickObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerClickObservable) {
            this._onPointerClickObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerClickObservable;
    }

    public get onPointerEnterObservable(): Observable<VirtualDisplay> {
        if (!this._onPointerEnterObservable) {
            this._onPointerEnterObservable = new Observable<VirtualDisplay>();
        }
        return this._onPointerEnterObservable;
    }

    public get onWheelObservable(): Observable<number> {
        if (!this._onWheelObservable) {
            this._onWheelObservable = new Observable<number>();
        }
        return this._onWheelObservable;
    }

    public get context(): TransformNode {
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
        this._onPointerMoveObservable?.clear();
        this._onPointerOutObservable?.clear();
        this._onPointerDownObservable?.clear();
        this._onPointerUpObservable?.clear();
        this._onPointerClickObservable?.clear();
        this._onPointerEnterObservable?.clear();
        this._onWheelObservable?.clear();
    }

    private _setupPointers(scene: Scene): void {
        this.isPickable = true; // enable pointer events
    }
}
