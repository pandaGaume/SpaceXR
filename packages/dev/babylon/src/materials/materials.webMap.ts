import { Scene } from "@babylonjs/core";
import { Map3dMaterial } from "./materials.elevation";

/**
 * The `WebMapMaterial` class represents a special material used for rendering map tiles.
 * It utilizes the Web Mercator projection to map these tiles onto a 3D elevation terrain,
 * which is represented as Plane Geometry. This material is specifically designed to
 * function within a `Map3D` object, rendering the map content as a plane with rectangular
 * boundaries.
 */
export class WebMapMaterial extends Map3dMaterial {
    public static ClassName: string = "WebMapMaterial";
    public static ShaderName: string = "webmap";

    /**
     * Creates a new `WebMapMaterial` object.
     * @param name The name of the material.
     * @param scene The scene the material belongs to.
     */
    public constructor(name: string, scene?: Scene) {
        super(name, WebMapMaterial.ShaderName, scene);
    }
}
