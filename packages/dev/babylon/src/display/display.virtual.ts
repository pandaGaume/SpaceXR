import { Matrix, Mesh, Scene, TransformNode, Vector2, Vector3, VertexBuffer, VertexData } from "@babylonjs/core";

import { Cartesian3, ICartesian3, ISize2, ISize3, Size2, Size3 } from "core/geometry";

import { VirtualDisplayInputsSource } from "./display.inputs.scene";
import { Observable, PropertyChangedEventArgs } from "core/events";
import { Length, Quantity, Unit } from "core/math";
import { IDisplay, IPhysicalDisplay } from "core/tiles";

export enum VirtualDisplayUVMode {
    KEEP = 0,
    STRETCH_U = 1,
    STRETCH_V = 2,
    STRETCH = 3,
}

export class VirtualDisplayOptions {
    resolution?: ISize2;
    target?: Mesh;
    uvMode: VirtualDisplayUVMode = VirtualDisplayUVMode.KEEP;
}

enum UVKind {
    MIN_U,
    MIN_V,
    MAX_U,
    MAX_V,
    DU,
    DV,
}

export class VirtualDisplay implements IPhysicalDisplay {
    public static QVGA: ISize2 = new Size2(320, 240);
    public static VGA: ISize2 = new Size2(640, 480);
    public static QHD: ISize2 = new Size2(960, 540);
    public static HD: ISize2 = new Size2(1280, 720);
    public static WXGA: ISize2 = new Size2(1280, 800);
    public static FullHD: ISize2 = new Size2(1980, 1080);
    public static UltraHD: ISize2 = new Size2(3840, 2160);
    public static UltraHD2: ISize2 = new Size2(7680, 4320);

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<IDisplay, unknown>>;

    _worldTransform: TransformNode;

    _dimension: ISize3;
    _halfDimension: ISize3;
    _ppu: Vector3;
    _ratio: Vector3;
    _unit: Unit;
    _uvs: Array<number>;

    _resolution: ISize3;
    _inputSource: VirtualDisplayInputsSource;
    _node: Mesh;
    _center: ICartesian3;

    // cached
    _inverseWorldMatrix?: Matrix;

    public constructor(name: string, dimension: ISize2, resolution: ISize2, scene?: Mesh | Scene, unit: Unit = Length.Units.meter) {
        this._dimension = Size3.FromSize(dimension);

        this._halfDimension = new Size3(this._dimension.width / 2, this._dimension.height / 2, this._dimension.depth / 2);
        this._resolution = Size3.FromSize(resolution);
        this._ppu = new Vector3(
            this._resolution.width / this._dimension.width,
            this._resolution.height / this._dimension.height,
            this._dimension.depth ? this._resolution.depth / this._dimension.depth : 0
        );
        this._ratio = new Vector3(this._ppu.x / this._ppu.y, this._ppu.z / this._ppu.y, this._ppu.z / this._ppu.x);
        if (scene == undefined || scene instanceof Scene) {
            this._node = new Mesh(name, scene);
            const data = this._buildVertexData(this._dimension);
            data.applyToMesh(this._node);
            this._center = Cartesian3.Zero();
        } else {
            this._node = scene;
            const vertices = scene.getVerticesData(VertexBuffer.PositionKind);
            this._center = vertices ? Cartesian3.Centroid(vertices) : Cartesian3.Zero();
        }
        this._uvs = this._buildUvs(this._node);
        this._worldTransform = new TransformNode(`${name}_context`, this._node.getScene());
        this._worldTransform.parent = this._node;
        this._node.isPickable = true; // enable pointer events
        this._inputSource = new VirtualDisplayInputsSource(this);
        this._unit = unit;
    }

    public get node(): Mesh {
        return this._node;
    }

    public getScene(): Scene {
        return this._node.getScene();
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<IDisplay, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<IDisplay, unknown>>();
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
        return this._inputSource;
    }

    protected _buildUvs(mesh: Mesh): Array<number> {
        // Extract UV data
        const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
        if (uvs) {
            let minU = Infinity;
            let minV = Infinity;
            let maxU = -Infinity;
            let maxV = -Infinity;

            // Iterate over the UV data (interleaved U and V)
            for (let i = 0; i < uvs.length; i += 2) {
                const u = uvs[i]; // U coordinate
                const v = uvs[i + 1]; // V coordinate

                // Update bounding box
                if (u < minU) minU = u;
                if (v < minV) minV = v;
                if (u > maxU) maxU = u;
                if (v > maxV) maxV = v;
            }
            return [minU, minV, maxU, maxV, maxU - minU, maxV - minV];
        }
        return [];
    }

    protected _buildVertexData(dimension: ISize2): VertexData {
        const data = new VertexData();
        const sx = dimension.width;
        const sy = dimension.height;

        data.positions = [0.5 * sx, -0.5 * sy, 0, 0.5 * sx, 0.5 * sy, 0, -0.5 * sx, 0.5 * sy, 0, -0.5 * sx, -0.5 * sy, 0];
        data.indices = [0, 3, 1, 3, 2, 1];
        data.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
        data.uvs = [0, 0, 0, 1, 1, 1, 1, 0];

        return data;
    }

    public get context3D(): TransformNode {
        return this._worldTransform;
    }

    /// <summary>
    /// Gets the display resolution in "pixels" like.
    /// </summary>
    public get resolution(): ISize3 {
        return this._resolution;
    }

    /// <summary>
    /// Gets the display dimension unit. Defualt is meter.
    /// </summary>
    public get unit(): Unit {
        return this._unit;
    }

    /// <summary>
    /// Gets the display dimension in current unit. Current unit may be accessed via <see cref="unit"/> property.
    public get dimension(): ISize3 {
        return this._dimension;
    }

    /// <summary>
    /// Gets the display half dimension in current unit.
    /// </summary>
    public get halfDimension(): ISize3 {
        return this._halfDimension;
    }

    public get pixelPerUnit(): ICartesian3 {
        return this._ppu;
    }

    public get dpi(): number {
        return Quantity.Convert(this._ppu.x, this._unit, Length.Units.inch);
    }

    public get aspectRatio(): ICartesian3 {
        return this._ratio;
    }

    public getPixelToRef0(pickedCoordinates: Vector2, pixel?: Vector2): Vector2 {
        pixel = pixel || Vector2.Zero();

        let d = pickedCoordinates.x - this._uvs[UVKind.MIN_U];
        let t = d / this._uvs[UVKind.DU];
        pixel.x = Math.round(t * this._resolution.width);
        d = pickedCoordinates.y - this._uvs[UVKind.MIN_V];
        t = d / this._uvs[UVKind.DV];
        pixel.y = this._resolution.height - Math.round(t * this._resolution.height);
        return pixel;
    }

    public getXYZWorldVectors(): Array<Vector3> {
        const transform = this._node.getWorldMatrix();
        const p = this._node.getAbsolutePosition();
        return [
            Vector3.TransformCoordinates(Vector3.Right(), transform).subtractInPlace(p),
            Vector3.TransformCoordinates(Vector3.Up(), transform).subtractInPlace(p),
            Vector3.TransformCoordinates(Vector3.Forward(), transform).subtractInPlace(p),
        ];
    }

    public dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        this._node.dispose(doNotRecurse, disposeMaterialAndTextures);
        this._worldTransform.dispose(doNotRecurse, disposeMaterialAndTextures);
    }
}
