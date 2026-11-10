import type { GeodeticSystem } from "@spacexr/geodesy";

import type { IUtmPlacement, IUtmPlacementOptions } from "./utm-types";
import type { IVerticalPlacement } from "./vertical-scale";

/** Mutable three-dimensional vector. ECEF values are expressed in metres. */
export interface IVector3 {
    /** X component. */
    x: number;
    /** Y component. */
    y: number;
    /** Z component. */
    z: number;
}

/** Plane equation `ax + by + cz + d = 0`. */
export interface IPlane {
    /** Plane-normal X component. */
    x: number;
    /** Plane-normal Y component. */
    y: number;
    /** Plane-normal Z component. */
    z: number;
    /** Signed plane offset. */
    w: number;
}

/** Axis-aligned ECEF bounding box. */
export interface IAxisAlignedBox {
    /** Minimum corner in ECEF metres. */
    min: IVector3;
    /** Maximum corner in ECEF metres. */
    max: IVector3;
}

/** Bounding sphere expressed in ECEF metres. */
export interface IBoundingSphere3 {
    /** Sphere centre. */
    center: IVector3;
    /** Sphere radius in metres. */
    radius: number;
}

/** Camera state consumed by {@link EcefSpatialMetric}. */
export interface IEcefCameraFrame {
    /** Optional application camera identifier. */
    id?: string;
    /** Camera position in ECEF metres. */
    position: IVector3;
    /** Viewport height in physical pixels. */
    viewportHeight: number;
    /** Vertical field of view in radians. */
    verticalFovRadians?: number;
    /** Precomputed tangent of half the vertical field of view. */
    tanHalfVerticalFov?: number;
    /** Optional normalized ECEF frustum planes. */
    frustumPlanes?: readonly IPlane[];
    /** Optional wider ECEF planes around the view: a tile between them and {@link frustumPlanes} is in the periphery. */
    peripheryFrustumPlanes?: readonly IPlane[];
    /** Optional coarse ECEF clipping box. */
    clipBounds?: IAxisAlignedBox;
    /** Optional source timestamp in milliseconds. */
    timestamp?: number;
}

/** Derived renderer-neutral spatial state for one runtime tile. */
export interface IEcefSpatialState {
    /** Column-major local-to-ECEF transform. */
    worldTransform: Float64Array;
    /** Optional enclosing ECEF sphere. */
    boundingSphere?: IBoundingSphere3;
    /** Optional enclosing ECEF axis-aligned box. */
    boundingBox?: IAxisAlignedBox;
    /** Lowest and highest heights of the terrain of the tile over the reference surface, in metres, when known. */
    heightRange?: readonly [number, number];
    /** World-space geometric error in metres. */
    geometricError: number;
    /** Report of the conversions and approximations applied, for tiles located by `SPACEXR_bounding_volume_utm`. */
    utmPlacement?: IUtmPlacement;
    /** Point whose height moves the tile with the vertical scale, when the metric has a vertical placement. */
    verticalAnchor?: IVector3;
    /** Origin of the object the tile belongs to; its descendants move with it. */
    verticalObject?: IVector3;
}

/** Configuration for the renderer-neutral ECEF spatial metric. */
export interface IEcefSpatialMetricOptions {
    /** Geodetic reference system used by region volumes and horizon culling. Defaults to WGS84. */
    geodeticSystem?: GeodeticSystem;
    /** Enables conservative ellipsoid horizon culling. Defaults to `true`. */
    horizonCulling?: boolean;
    /**
     * Test of the horizon.
     *
     * - `plane`, the default: tiles behind the plane of the horizon of the smallest sphere of the ellipsoid. It suits oblate
     *   bodies, where that sphere lies below the surface. It culls a summit that still shows above the horizon, and on a
     *   sphere what lies deeper below the reference surface than the camera is above it.
     * - `tile-heights`: the horizons of the camera and of the highest point of the tile, from the radius of the body and the
     *   heights of the tile. The hiding sphere lies below the lowest terrain measured so far, since a sight line may pass over
     *   any basin on its way. For spherical bodies.
     */
    horizon?: "plane" | "tile-heights";
    /** Viewport height fallback in pixels. Defaults to 1080. */
    defaultViewportHeight?: number;
    /** Vertical field-of-view fallback in radians. Defaults to 60 degrees. */
    defaultVerticalFovRadians?: number;
    /** Datum transformation and geoid model used to place `SPACEXR_bounding_volume_utm` extents. */
    utm?: IUtmPlacementOptions;
    /**
     * Moves the bounds of objects with the vertical scale of the scene. Not for terrain tiles, whose volumes already hold
     * their scaled heights.
     */
    vertical?: IVerticalPlacement;
}
