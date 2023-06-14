import { IMapDisplay } from "core/map";
import { ISize3 } from "core/geometry/geometry.interfaces";
import { Scene } from "@babylonjs/core";
import { VirtualDisplay } from "../../holograms/virtualdisplay";
export declare class SurfaceMapDisplay extends VirtualDisplay implements IMapDisplay {
    constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene);
}
