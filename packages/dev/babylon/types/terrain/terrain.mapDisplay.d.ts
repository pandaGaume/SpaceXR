import { IMapDisplay } from "@dev/core/src/map";
import { ICartesian3, ISize2 } from "@dev/core/src/geometry/geometry.interfaces";
import { Size3 } from "@dev/core/src/geometry/geometry.size";
import { Scene, TransformNode } from "@babylonjs/core";
export declare class SurfaceMapDisplay extends TransformNode implements IMapDisplay {
    static FromResolution(name: string, scene: Scene, dimensions: Size3, resolutions: ICartesian3): SurfaceMapDisplay;
    _dimensions: Size3;
    _dpi: ICartesian3;
    constructor(name: string, scene: Scene, dimensions: Size3, dpi: number | ICartesian3);
    get resolution(): ISize2;
}
