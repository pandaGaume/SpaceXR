import { IBoundingVolume } from "./boundingVolume";
import { IContent } from "./content";
import { IMetadataEntity } from "./metadataEntity";
import { IImplicitTiling } from "./tile.implicitTiling";

export type RefineType = "ADD" | "REPLACE" | string;
export type Mat44Type = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
export type Vec3Type = [number, number, number];
export type Point3Type = [number, number, number];

export function TransformVec3(transform: Mat44Type, v: Vec3Type, ref?: Vec3Type): Vec3Type {
    const x = v[0],
        y = v[1],
        z = v[2];
    const tx = transform[0] * x + transform[4] * y + transform[8] * z + transform[12];
    const ty = transform[1] * x + transform[5] * y + transform[9] * z + transform[13];
    const tz = transform[2] * x + transform[6] * y + transform[10] * z + transform[14];

    if (ref) {
        ref[0] = tx;
        ref[1] = ty;
        ref[2] = tz;
        return ref;
    }
    return [tx, ty, tz];
}

export function TransformPoint3(transform: Mat44Type, v: Point3Type, ref?: Point3Type): Point3Type {
    const x = v[0],
        y = v[1],
        z = v[2];
    const tx = transform[0] * x + transform[4] * y + transform[8] * z;
    const ty = transform[1] * x + transform[5] * y + transform[9] * z;
    const tz = transform[2] * x + transform[6] * y + transform[10] * z;

    if (ref) {
        ref[0] = tx;
        ref[1] = ty;
        ref[2] = tz;
        return ref;
    }
    return [tx, ty, tz];
}

/**
 * A tile in a 3D Tiles tileset.
 */
export interface ITile3d {
    boundingVolume: IBoundingVolume;
    viewerRequestVolume?: IBoundingVolume;
    /**
     * The error, in meters, introduced if this tile is rendered and its children are not. At runtime, the geometric error is used to compute screen space error (SSE), i.e., the error measured in pixels.
     */
    geometricError: number;
    /**
     * Specifies if additive or replacement refinement is used when traversing the tileset for rendering. This property is required for the root tile of a tileset; it is optional for all other tiles. The default is to inherit from the parent tile.
     */
    refine?: RefineType;
    /**
     * A floating-point 4x4 affine transformation matrix, stored in column-major order, that transforms the tile's content--i.e., its features as well as content.boundingVolume, boundingVolume, and viewerRequestVolume--from the tile's local coordinate system to the parent tile's coordinate system, or, in the case of a root tile, from the tile's local coordinate system to the tileset's coordinate system. `transform` does not apply to any volume property when the volume is a region, defined in EPSG:4979 coordinates. `transform` scales the `geometricError` by the maximum scaling factor from the matrix.
     *
     * @minItems 16
     * @maxItems 16
     */
    transform?: Mat44Type;
    content?: IContent;
    /**
     * An array of contents. When this is defined, then `content` shall be undefined.
     *
     * @minItems 1
     */
    contents?: Array<IContent>;
    metadata?: IMetadataEntity;
    implicitTiling?: IImplicitTiling;
    /**
     * An array of objects that define child tiles. Each child tile content is fully enclosed by its parent tile's bounding volume and, generally, has a geometricError less than its parent tile's geometricError. For leaf tiles, there are no children, and this property may not be defined.
     *
     * @minItems 1
     */
    children?: [ITile3d, ...ITile3d[]];
}
