import { Matrix, Mesh, Scene, TmpVectors, TransformNode, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { ICartesian3, ICartesian4, ISize3, Size3 } from "core/geometry";
import { IPointerSource } from "core/map/inputs";
import { Observable } from "core/events";

/**
 *  This logical display will be used to be placed accordingly of a existing mesh surface into the scene.
 */
export class VirtualDisplay extends Mesh implements IPointerSource<VirtualDisplay> {
    
    public onPointerMoveObservable = new Observable<ICartesian4>();
    public onPointerOutObservable = new Observable<VirtualDisplay>();
    public onPointerDownObservable = new Observable<ICartesian4>();
    public onPointerUpObservable = new Observable<ICartesian4>();
    public onPointerClickObservable = new Observable<ICartesian4>();
    public onPointerEnterObservable = new Observable<VirtualDisplay>();

    _context: TransformNode;

    _dimension: ISize3;
    _halfDimension: ISize3;
    _resolution: ISize3;
    _ppu: Vector3;
    // cached
    _invWorld?: Matrix;

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
        this._context = new TransformNode(`${name}_context`, scene);
        this._context.parent = this;
    }

    public get context(): TransformNode {
        return this._context;
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
            this._invWorld = this._invWorld || this.worldMatrixFromCache.invertToRef(this._invWorld || Matrix.Zero());
        } else {
            const cached = this.worldMatrixFromCache;
            const world = this.getWorldMatrix();
            if (!world.equals(cached) || !this._invWorld) {
                this._invWorld = world.invertToRef(this._invWorld || Matrix.Zero());
            }
        }
        return this._invWorld;
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
}
