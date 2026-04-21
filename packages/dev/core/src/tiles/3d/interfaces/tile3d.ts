import { IBoundingVolume } from "./boundingVolume";
import { IContent } from "./content";
import { Mat44Type } from "./math/math";
import { IMetadataEntity } from "./metadataEntity";
import { IImplicitTiling } from "./tile.implicitTiling";

export type RefineType = "ADD" | "REPLACE" | string;

/**
 * A tile in a 3D Tiles tileset.
 */
export interface ITile3d {
    boundingVolume: IBoundingVolume;
    viewerRequestVolume?: IBoundingVolume;
    /**
     * The error, in meters, introduced if this tile is rendered and its children are not.
     * At runtime, the geometric error is used to compute screen space error (SSE), i.e., the error measured in pixels.
     */
    geometricError: number;
    /**
     * Specifies if additive or replacement refinement is used when traversing the tileset for rendering.
     * This property is required for the root tile of a tileset; it is optional for all other tiles. The default is to inherit from the parent tile.
     */
    refine?: RefineType;
    /**
     * A floating-point 4x4 affine transformation matrix, stored in column-major order, that transforms the tile's content--i.e.,
     * its features as well as content.boundingVolume, boundingVolume, and viewerRequestVolume--from the tile's local coordinate
     * system to the parent tile's coordinate system, or, in the case of a root tile, from the tile's local coordinate system to
     * the tileset's coordinate system.
     * `transform` does not apply to any volume property when the volume is a region, defined in EPSG:4979 coordinates.
     * `transform` scales the `geometricError` by the maximum scaling factor from the matrix.
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
     * An array of objects that define child tiles. Each child tile content is fully enclosed by its parent tile's bounding volume and,
     * generally, has a geometricError less than its parent tile's geometricError. For leaf tiles, there are no children, and this property may not be defined.
     *
     * @minItems 1
     */
    children?: [ITile3d, ...ITile3d[]];
}

export function GetTile3dContents(tile: ITile3d): IContent[] | undefined {
    return tile.contents ?? (tile.content ? [tile.content] : undefined);
}
/**
 * Type guard to check if an object is a valid ITile3d
 */
export function IsTile3d(obj: unknown): obj is ITile3d {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const t = obj as ITile3d;

    // Required property
    if (typeof t.geometricError !== "number") return false;
    if (!t.boundingVolume || typeof t.boundingVolume !== "object") return false;

    // Optional checks (lightweight, only structure)
    if (t.viewerRequestVolume && typeof t.viewerRequestVolume !== "object") return false;
    if (t.refine && typeof t.refine !== "string") return false;
    if (t.transform && (!Array.isArray(t.transform) || t.transform.length !== 16)) return false;
    if (t.content && typeof t.content !== "object") return false;
    if (t.contents && !Array.isArray(t.contents)) return false;
    if (t.children && !Array.isArray(t.children)) return false;

    return true;
}
