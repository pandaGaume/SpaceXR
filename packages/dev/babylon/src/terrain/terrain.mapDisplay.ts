import { IMapDisplay } from "@dev/core/src/map";
import { ICartesian3, ISize2, isCartesian3 } from "@dev/core/src/geometry/geometry.interfaces";
import { Cartesian3 } from "@dev/core/src/geometry/geometry.cartesian";
import { Size2, Size3 } from "@dev/core/src/geometry/geometry.size";
import { Scene, TransformNode } from "@babylonjs/core";

/**
 * The surface map display is a virtual surface holding the anchor and dimension of the map with :
 *  - Fixed physical sizes in inches, within the 3 axes
 *  - Resolution in dpi within the 3 axes
 *  * the formula will be
 *       width = dimension.width * dpi.width
 *       height = dimension.height * dpi.height
 *  This logical display will be used to be placed accordingly of a existing mesh surface into the scene.
 */
export class SurfaceMapDisplay extends TransformNode implements IMapDisplay {
    public static FromResolution(name: string, scene: Scene, dimensions: Size3, resolutions: ICartesian3) {
        const d = new SurfaceMapDisplay(name, scene, dimensions, 0);
        d._dpi.x = resolutions.x / dimensions.width;
        d._dpi.y = resolutions.y / dimensions.height;
        d._dpi.z = resolutions.z / dimensions.thickness;
        return d;
    }

    _dimensions: Size3;
    _dpi: ICartesian3;

    public constructor(name: string, scene: Scene, dimensions: Size3, dpi: number | ICartesian3) {
        super(name, scene);
        this._dimensions = dimensions;
        this._dpi = isCartesian3(dpi) ? new Cartesian3(dpi.x, dpi.y, dpi.z) : new Cartesian3(dpi, dpi, dpi);
    }

    public get resolution(): ISize2 {
        return new Size2(this._dimensions.width * this._dpi.y, this._dimensions.height * this._dpi.z);
    }
}
