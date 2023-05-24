import { IMapDisplay } from "core/map";
import { ICartesian3, ISize2, ISize3 } from "core/geometry/geometry.interfaces";
import { Scene, TransformNode } from "@babylonjs/core";
export declare enum SurfaceMapPlane {
    XY = 0,
    XZ = 1,
    YZ = 2
}
export declare class SurfaceMapDisplay extends TransformNode implements IMapDisplay {
    static FromResolution(name: string, dimensions: ISize3, resolutions: ICartesian3, scene?: Scene): SurfaceMapDisplay;
    _dimensions: ISize3;
    _dpi: ICartesian3;
    constructor(name: string, dimensions: ISize3, dpi: number | ICartesian3, scene?: Scene);
    get resolution(): ISize2;
    get dimensions(): ISize3;
    getAspectRatio(ref?: SurfaceMapPlane): number;
}
