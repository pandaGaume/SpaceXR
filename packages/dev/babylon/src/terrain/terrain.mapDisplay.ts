import { IMapDisplay } from "core/map";
import { ICartesian3, ISize2, ISize3, isCartesian3 } from "core/geometry/geometry.interfaces";
import { Cartesian3 } from "core/geometry/geometry.cartesian";
import { Size2 } from "core/geometry/geometry.size";
import { Scene, TransformNode } from "@babylonjs/core";
import { Scalar } from "core/math";

export enum SurfaceMapPlane {
    XY,
    XZ,
    YZ,
}

/**
 * The surface map display is a virtual surface holding the anchor and dimension of the map with :
 *  - Fixed physical sizes in meter, within the 3 axes
 *  - Resolution in dpi within the 3 axes
 *  * the formula will be
 *       width = dimension.width * dpi.width
 *       height = dimension.height * dpi.height
 *  This logical display will be used to be placed accordingly of a existing mesh surface into the scene.
 */
export class SurfaceMapDisplay extends TransformNode implements IMapDisplay {
    public static FromResolution(name: string, dimensions: ISize3, resolutions: ICartesian3, scene?: Scene) {
        const d = new SurfaceMapDisplay(name, dimensions, 0, scene);
        d._dpi.x = resolutions.x / (dimensions.width * Scalar.METER2INCH);
        d._dpi.y = resolutions.y / (dimensions.height * Scalar.METER2INCH);
        d._dpi.z = resolutions.z / (dimensions.thickness * Scalar.METER2INCH);
        return d;
    }

    _dimension: ISize3;
    _dpi: ICartesian3;

    public constructor(name: string, dimensions: ISize3, dpi: number | ICartesian3, scene?: Scene) {
        super(name, scene);
        this._dimension = dimensions;
        this._dpi = isCartesian3(dpi) ? new Cartesian3(dpi.x, dpi.y, dpi.z) : new Cartesian3(dpi, dpi, dpi);
    }

    public get resolution(): ISize2 {
        return new Size2(this._dimension.width * Scalar.METER2INCH * this._dpi.x, this._dimension.height * Scalar.METER2INCH * this._dpi.y);
    }

    public get dimension(): ISize3 {
        return this._dimension;
    }

    public getAspectRatio(ref: SurfaceMapPlane = SurfaceMapPlane.XY): number {
        switch (ref) {
            case SurfaceMapPlane.XZ: {
                return this._dimension.width / this._dimension.thickness;
            }
            case SurfaceMapPlane.YZ: {
                return this._dimension.height / this._dimension.thickness;
            }
            case SurfaceMapPlane.XY:
            default: {
                return this._dimension.width / this._dimension.height;
            }
        }
    }
}
