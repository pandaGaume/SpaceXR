import { ISize3 } from "core/geometry/geometry.interfaces";
import { Size3 } from "core/geometry/geometry.size";
import { Matrix, Mesh, Scene, Vector2, Vector3, VertexData } from "@babylonjs/core";

/**
 * The surface map display is a virtual surface holding the anchor and dimension of the map with :
 *  - Fixed physical sizes in meter, within the 3 axes
 *  - Resolution in pixel within the 3 axes
 *  This logical display will be used to be placed accordingly of a existing mesh surface into the scene.
 */
export class VirtualDisplay extends Mesh {
    _dimension: ISize3;
    _halfDimension: ISize3;
    _resolution: ISize3;
    _ppu: Vector3;

    // tmp
    _invTmp = Matrix.Identity();
    _transformedTmp = Vector3.Zero();

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
    }

    public get resolution(): ISize3 {
        return this._resolution;
    }

    public get dimension(): ISize3 {
        return this._dimension;
    }

    public getPixelToRef(pickedCoordinates: Vector3, pixel?: Vector2): Vector2 {
        const transform = this.getWorldMatrix().invertToRef(this._invTmp);
        const transformed = Vector3.TransformCoordinatesToRef(pickedCoordinates, transform, this._transformedTmp);
        pixel = pixel || Vector2.Zero();
        pixel.x = this._resolution.width - Math.round((this._halfDimension.width - transformed.x) * this._ppu.x);
        pixel.y = this._resolution.height - Math.round((this._halfDimension.height - transformed.y) * this._ppu.y);
        return pixel;
    }
}
