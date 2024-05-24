import { Matrix, Mesh, Nullable, Observable, Scene, TmpVectors, TransformNode, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { ICartesian3, ISize2, Size2 } from "core/geometry";

import { VirtualDisplayInputsSource } from "./display.inputs.scene";
import { ClipIndex, ClipPlaneDefinition, IClipableContent } from "./display.clipPlane";

export class VirtualDisplay extends Mesh implements IClipableContent {
    public static SD: ISize2 = new Size2(640, 480);
    public static QHD: ISize2 = new Size2(960, 540);
    public static HD: ISize2 = new Size2(1280, 720);
    public static WXGA: ISize2 = new Size2(1280, 800);
    public static FullHD: ISize2 = new Size2(1980, 1080);
    public static UltraHD: ISize2 = new Size2(3840, 2160);
    public static UltraHD_2: ISize2 = new Size2(7680, 4320);

    public static BuildCardinalClipPlanes(display: VirtualDisplay): Array<ClipPlaneDefinition> {
        const clipPlanes = new Array<ClipPlaneDefinition>();
        const halfWidth: number = display.dimension.width / 2;
        const halfHeight: number = display.dimension.height / 2;

        const nNorth = new Vector3(0, 1, 0);
        const nSouth = new Vector3(0, -1, 0);
        const nEast = new Vector3(1, 0, 0);
        const nWest = new Vector3(-1, 0, 0);

        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.North, display.position.add(nNorth.scale(halfHeight)), nSouth));
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.South, display.position.add(nSouth.scale(halfHeight)), nNorth));
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.East, display.position.add(nEast.scale(halfWidth)), nWest));
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.West, display.position.add(nWest.scale(halfWidth)), nEast));

        return clipPlanes;
    }

    private _clipPlanesAddedObservable?: Observable<Array<ClipPlaneDefinition>>;
    private _clipPlanesRemovedObservable?: Observable<Array<ClipPlaneDefinition>>;

    private _clipPlanes: Nullable<Array<ClipPlaneDefinition>> = null;

    _worldTransform: TransformNode;

    _dimension: ISize2;
    _halfDimension: ISize2;
    _resolution: ISize2;
    _ppu: Vector3;
    _pointerSource: VirtualDisplayInputsSource;

    // cached
    _inverseWorldMatrix?: Matrix;

    public constructor(name: string, dimension: ISize2, resolution: ISize2, buildClipPlanes: boolean = false, scene?: Scene) {
        super(name, scene);
        this._dimension = dimension;
        this._halfDimension = new Size2(dimension.width / 2, dimension.height / 2);
        this._resolution = resolution;
        this._ppu = new Vector3(resolution.width / dimension.width, resolution.height / dimension.height);

        const data = this._buildVertexData();
        data.applyToMesh(this);
        this._worldTransform = new TransformNode(`${name}_context`, scene);
        this._worldTransform.parent = this;
        this.isPickable = true; // enable pointer events
        this._pointerSource = new VirtualDisplayInputsSource(this);
        if (buildClipPlanes) {
            this.addClipPlane(...VirtualDisplay.BuildCardinalClipPlanes(this));
        }
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
        data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
        return data;
    }

    public get context3D(): TransformNode {
        return this._worldTransform;
    }

    public get resolution(): ISize2 {
        return this._resolution;
    }

    public get dimension(): ISize2 {
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

    public get clipPlanesAddedObservable(): Observable<Array<ClipPlaneDefinition>> {
        if (!this._clipPlanesAddedObservable) {
            this._clipPlanesAddedObservable = new Observable<Array<ClipPlaneDefinition>>();
        }
        return this._clipPlanesAddedObservable;
    }

    public get clipPlanesRemovedObservable(): Observable<Array<ClipPlaneDefinition>> {
        if (!this._clipPlanesRemovedObservable) {
            this._clipPlanesRemovedObservable = new Observable<Array<ClipPlaneDefinition>>();
        }
        return this._clipPlanesRemovedObservable;
    }

    public get clipPlanes(): Nullable<Array<ClipPlaneDefinition>> {
        return this._clipPlanes;
    }

    public get clipPlanesWorld(): Nullable<Array<ClipPlaneDefinition>> {
        if (!this._clipPlanes || this._clipPlanes.length === 0) return null;
        const world = new Array<ClipPlaneDefinition>();
        const transform = this.getWorldMatrix();
        for (const plane of this._clipPlanes) {
            const p = Vector3.TransformCoordinates(plane.point, transform);
            const n = Vector3.TransformNormal(plane.normal, transform);
            world.push(new ClipPlaneDefinition(plane.index, p, n));
        }
        return world;
    }

    public addClipPlane(...clipPlanes: ClipPlaneDefinition[]): IClipableContent {
        if (clipPlanes.length === 0) return this;
        if (this._clipPlanes == null) this._clipPlanes = new Array<ClipPlaneDefinition>();
        const added: Nullable<ClipPlaneDefinition[]> = this._clipPlanesAddedObservable ? [] : null;
        for (const clipPlane of clipPlanes) {
            const existing = this._clipPlanes.find((plane) => plane.index === clipPlane.index);
            if (existing) {
                if (!existing.point.equals(clipPlane.point) || !existing.normal.equals(clipPlane.normal)) {
                    existing.point.copyFrom(clipPlane.point);
                    existing.normal.copyFrom(clipPlane.normal);
                    added?.push(existing);
                }
                continue;
            }
            this._clipPlanes.push(clipPlane);
            added?.push(clipPlane);
        }
        if (added && added.length > 0) {
            this._clipPlanesAddedObservable?.notifyObservers(added, -1, this, this);
        }
        return this;
    }

    public removeClipPlane(...indices: ClipIndex[]): IClipableContent {
        if (!this._clipPlanes || this._clipPlanes.length === 0) return this;

        const removed: Nullable<ClipPlaneDefinition[]> = this._clipPlanesAddedObservable ? [] : null;
        for (const index of indices) {
            const i = this._clipPlanes.findIndex((plane) => index === plane.index);
            if (i >= 0) {
                const tmp = this._clipPlanes.splice(i, 1)[0];
                removed?.push(tmp);
            }
        }
        if (removed && removed.length > 0) {
            this._clipPlanesRemovedObservable?.notifyObservers(removed, -1, this, this);
        }
        return this;
    }

    public clearClipPlanes(): IClipableContent {
        if (!this._clipPlanes || this._clipPlanes.length === 0) return this;
        const removed: Nullable<ClipPlaneDefinition[]> = this._clipPlanesAddedObservable ? [] : null;
        removed?.push(...this._clipPlanes);
        this._clipPlanes = [];
        if (removed && removed.length > 0) {
            this._clipPlanesRemovedObservable?.notifyObservers(removed, -1, this, this);
        }
        return this;
    }
}
