/// <summary>
/// Represents the root structure of a 3D Tileset, as streamed from a server.

import { Nullable } from "../../../types";
import { ICameraState } from "../../navigation";
import { IDisplay } from "../../map";

/// </summary>
export interface IStreamingTileset {
    asset: IStreamingAsset;
    geometricError: number;
    root: IStreamingTile;
    extensionsUsed?: string[];
    extensionsRequired?: string[];
    extensions?: IStreamingExtensions;
    properties?: IStreamingProperties;
}

/// <summary>
/// Metadata about the streamed tileset.
/// </summary>
export interface IStreamingAsset {
    version: string;
    tilesetVersion?: string;
    generator?: string;
}

/// <summary>
/// Represents a single streamed tile in the tileset hierarchy.
/// </summary>
export interface IStreamingTile {
    boundingVolume: IStreamingBoundingVolume;
    geometricError: number;
    transform?: number[];
    refine?: "ADD" | "REPLACE";
    content?: IStreamingContent;
    children?: IStreamingTile[];

    // If the tile is part of an implicit tiling structure
    implicitTiling?: IStreamingImplicitTiling;

    extensions?: IStreamingExtensions;
}

/// <summary>
/// Defines the bounding volume of a streamed tile.
/// </summary>
export interface IStreamingBoundingVolume {
    box?: number[]; // [cx, cy, cz, sx, sy, sz, qx, qy, qz, qw]
    region?: number[]; // [west, south, east, north, minHeight, maxHeight]
    sphere?: number[]; // [cx, cy, cz, radius]
}

/// <summary>
/// Defines the content of a streamed tile, which may reference a binary tile, glTF, or another tileset.json.
/// </summary>
export interface IStreamingContent {
    uri: string; // Can point to .b3dm, .i3dm, .pnts, .glb, .gltf, or another tileset.json
    boundingVolume?: IStreamingBoundingVolume;
    extensions?: IStreamingExtensions;
}

/// <summary>
/// Represents properties used in the streamed tileset metadata.
/// </summary>
export interface IStreamingProperties {
    [propertyName: string]: {
        minimum?: number;
        maximum?: number;
    };
}

/// <summary>
/// Defines extensions, allowing for additional functionality in streamed tilesets.
/// </summary>
export interface IStreamingExtensions {
    [key: string]: any;
}

/// <summary>
/// Defines implicit tiling parameters, enabling parametric generation of tiles.
/// </summary>
export interface IStreamingImplicitTiling {
    subdivisionScheme: "QUADTREE" | "OCTREE"; // Defines how the tiles subdivide
    subtreeLevels: number; // Number of levels in each subtree
    availableLevels: number; // Total number of levels available
    tileIndexSchema: string; // Defines how tiles are indexed (e.g., Morton order)
    subtrees: IStreamingSubtreeReferences; // References to subtree storage
}

/// <summary>
/// Defines the storage location of subtree files.
/// </summary>
export interface IStreamingSubtreeReferences {
    uri: string; // Reference pattern to a subtree file
}

export interface IStreamingTile3dSelectionContextOptions {}

export interface IStreamingTile3dSelectionContext {
    setContext(state: Nullable<ICameraState>, display: Nullable<IDisplay>, options?: IStreamingTile3dSelectionContextOptions): void;
}
