import type { IUtmProjection } from "@spacexr/3d-tiles-core";
import type { IGeodeticCoordinates } from "@spacexr/geodesy";

/**
 * Horizontal datum transformation from the datum of a UTM extent to the geodetic system of the spatial metric.
 */
export interface IHorizontalDatumTransformation {
    /** Identification of the transformation, for example `EPSG:1188 NAD83 to WGS 84 (1)`. */
    readonly name: string;
    /**
     * Horizontal accuracy of the transformation in metres.
     * Derived bounds are widened by this distance so that the true position stays inside them.
     */
    readonly accuracy: number;
    /**
     * Transforms geodetic coordinates in radians, in place, from the source datum to the target system.
     * Omitted for a null transformation, whose whole error is covered by `accuracy`.
     */
    transform?(geodetic: IGeodeticCoordinates): void;
}

/**
 * Selects the transformation of a resolved UTM projection.
 * Returns `undefined` when no transformation is known, in which case the extent is not placed.
 */
export type HorizontalDatumResolver = (projection: IUtmProjection) => IHorizontalDatumTransformation | undefined;

/**
 * Geoid model returning the geoid undulation `N` in metres at a geodetic position in radians,
 * so that ellipsoidal height equals orthometric height plus `N`.
 */
export type GeoidUndulationModel = (latitudeRadians: number, longitudeRadians: number) => number;

/** Options controlling how UTM extents are placed in ECEF. */
export interface IUtmPlacementOptions {
    /** Datum transformation resolver. Defaults to {@link defaultHorizontalDatumResolver}, which targets WGS 84. */
    datumResolver?: HorizontalDatumResolver;
    /** Geoid model for orthometric heights. Without it, {@link GEOID_UNDULATION_MARGIN} is applied. */
    geoidUndulation?: GeoidUndulationModel;
}

/**
 * Outcome of placing a UTM extent.
 *
 * - `placed`: bounds were derived.
 * - `unresolved-projection`: the zone and hemisphere could not be determined; no bounds were derived.
 * - `unresolved-datum`: no datum transformation is known for the source datum; no bounds were derived.
 */
export type UtmPlacementStatus = "placed" | "unresolved-projection" | "unresolved-datum";

/**
 * Origin of the ellipsoidal heights used for the bounds.
 *
 * - `ellipsoid`: values were already ellipsoidal heights.
 * - `geoid`: values were orthometric heights.
 * - `ground-elevation`: values were measured from `groundElevation`, treated as an orthometric height.
 * - `assumed-terrain`: the vertical origin is unknown, so {@link UNKNOWN_GROUND_HEIGHT_RANGE} was assumed.
 */
export type UtmVerticalOrigin = "ellipsoid" | "geoid" | "ground-elevation" | "assumed-terrain";

/** Explicit report of the conversions and approximations applied to a UTM extent. */
export interface IUtmPlacement {
    status: UtmPlacementStatus;
    /** Resolved zone, hemisphere and datum, when available. */
    projection?: IUtmProjection;
    /** Applied datum transformation, when available. */
    datumTransformation?: Pick<IHorizontalDatumTransformation, "name" | "accuracy">;
    /** Horizontal widening of the bounds in metres. */
    horizontalMargin: number;
    verticalOrigin?: UtmVerticalOrigin;
    /** How orthometric heights were converted, when the vertical origin requires it. */
    geoid?: "model" | "margin";
    /** Vertical widening in metres applied for the geoid margin. `assumed-terrain` extents use `heightRange` instead. */
    verticalMargin: number;
    /** Height interval in metres used for the bounds. With a geoid model, the undulation of each sample is added to it. */
    heightRange?: readonly [number, number];
}
