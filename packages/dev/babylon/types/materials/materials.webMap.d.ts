import { Scene } from "@babylonjs/core";
import { Map3dMaterial } from "./materials.map";
/**
 * The `WebMapMaterial` class represents a special material used for rendering map tiles.
 * It utilizes the Web Mercator projection to map these tiles onto a 3D elevation terrain,
 * which is represented as Plane Geometry. This material is specifically designed to
 * function within a `Map3D` object, rendering the map content as a plane with rectangular
 * boundaries.
 */
export declare class WebMapMaterial extends Map3dMaterial {
    static ClassName: string;
    static ShaderName: string;
    /**
     * Creates a new `WebMapMaterial` object.
     * @param name The name of the material.
     * @param scene The scene the material belongs to.
     */
    constructor(name: string, scene?: Scene);
    getClassName(): string;
}
