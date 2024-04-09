import { Map3dMaterial } from "./materials.map3d";

/**
 * The `EllipsoidalMapMaterial` class represents a special material used for rendering map tiles.
 * It employs the Cartesian coordinate system (known as ECF - Earth-Centered, Earth-Fixed, and ENU - East, North, Up)
 * to project these tiles onto a 3D elevation terrain, which is represented as ellipsoidal geometry.
 * This material is specifically designed to operate within a `Map3D` object,
 * rendering the map content on an ellipsoidal surface with defined boundaries.
 */

export class EllipsoidalMapMaterial extends Map3dMaterial {
    public static ClassName: string = "EllipsoidalMapMaterial";
    public static ShaderName: string = "ellipsoidalmap";
}
