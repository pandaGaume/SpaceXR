import { IMapDisplay } from "core/map";
import { ISize3 } from "core/geometry/geometry.interfaces";
import { Scene } from "@babylonjs/core";
import { VirtualDisplay } from "../../holograms/virtualdisplay";

/**
 * The surface map display is a virtual surface holding the anchor and dimension of the map with :
 *  - Fixed physical sizes in meter, within the 3 axes
 *  - Resolution in pixel within the 3 axes
 *  This logical display will be used to be placed accordingly of a existing mesh surface into the scene.
 */
export class SurfaceMapDisplay extends VirtualDisplay implements IMapDisplay {
    public constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene) {
        super(name, dimension, resolution, scene);
    }
}
