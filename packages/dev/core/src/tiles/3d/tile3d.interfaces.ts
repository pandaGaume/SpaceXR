import { IGeoBounded } from "../../geography";
import { Cartesian3, IBounded, IBounds } from "../../geometry";
import { ISpatialTreeNode } from "../../tree/tree.spatial.interfaces";

export enum RefinementStrategy {
    ADDITIVE,
    REPLACEMENT,
}

// 3D Tiles uses a right-handed Cartesian coordinate system; that is, the cross product of x and y yields z.
// 3D Tiles defines the z axis as up for local Cartesian coordinate systems. A tileset’s global coordinate
// system will often be in a WGS 84 Earth-centered, Earth-fixed (ECEF) reference frame (EPSG 4978), but it doesn’t have to be, e.g.,
// a power plant may be defined fully in its local coordinate system for use with a modeling tool without a geospatial context.
export interface ITile3DNode<T extends IBounds | IBounded> extends ISpatialTreeNode<T>, IGeoBounded {
    // Refinement determines the process by which a lower resolution parent tile renders when its higher resolution children are selected
    // to be rendered.
    // Permitted refinement types are replacement ("REPLACE") and additive ("ADD").
    // If the tile has replacement refinement, the children tiles are rendered in place of the parent, that is, the parent tile is no longer
    // rendered. If the tile has additive refinement, the children are rendered in addition to the parent tile.
    // A tileset can use replacement refinement exclusively, additive refinement exclusively, or any combination of additive and replacement
    // refinement.
    // A refinement type is required for the root tile of a tileset; it is optional for all other tiles. When omitted,
    // a tile inherits the refinement type of its parent
    refinementStrategy: RefinementStrategy;

    // Tiles are structured into a tree incorporating Hierarchical Level of Detail (HLOD) so that at runtime a client implementation
    // will need to determine if a tile is sufficiently detailed for rendering and if the content of tiles should be successively
    // refined by children tiles of higher resolution. An implementation will consider a maximum allowed Screen-Space Error (SSE),
    // the error measured in pixels.
    // A tile’s geometric error defines the selection metric for that tile. Its value is a nonnegative number that specifies the error,
    // in meters, of the tile’s simplified representation of its source geometry. Generally, the root tile will have the largest
    // geometric error, and each successive level of children will have a smaller geometric error than its parent, with leaf tiles having
    // a geometric error of or close to 0.
    // In a client implementation, geometric error is used with other screen space metrics—​e.g., distance from the tile to the camera,
    // screen size, and resolution— to calculate the SSE introduced if this tile is rendered and its children are not.
    // If the introduced SSE exceeds the maximum allowed, then the tile is refined and its children are considered for rendering.
    // The geometric error is formulated based on a metric like point density, mesh or texture decimation, or another factor specific
    // to that tileset. In general, a higher geometric error means a tile will be refined more aggressively, and children tiles will be
    // loaded and rendered sooner.
    geometricError: number;
}

export function ScreenSpaceError<T extends IBounds | IBounded>(node: ITile3DNode<T>, position: Cartesian3, viewportHeight: number, fov: number): number {
    const center = node.boundingBox?.center ?? Cartesian3.Zero();
    const d = Cartesian3.Distance(center, position);
    return (node.geometricError * viewportHeight) / (d * Math.tan(fov / 2));
}

export function ScreenSpaceError0(geometricError: number, distance: number, viewportHeight: number, tanfov2: number): number {
    return (geometricError * viewportHeight) / (distance * tanfov2);
}
