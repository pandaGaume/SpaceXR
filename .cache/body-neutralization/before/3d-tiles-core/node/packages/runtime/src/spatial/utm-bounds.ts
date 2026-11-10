import { resolveUtmProjection, type IUtmBoundingVolume, type IUtmProjection, type IVerticalExtent } from "@spacexr/3d-tiles-core";
import { Ellipsoid, UtmProjection, type GeodeticSystem } from "@spacexr/geodesy";

import { boundsFromPoints, type EcefBounds } from "./bounding-volumes";
import type { IVector3 } from "./ecef-types";
import type { IHorizontalDatumTransformation, IUtmPlacement, IUtmPlacementOptions, UtmVerticalOrigin } from "./utm-types";

/**
 * Margin in metres applied to orthometric heights when no geoid model is supplied.
 *
 * The EGM2008 geoid undulation ranges from about -106 m (Indian Ocean) to about +86 m (New Guinea).
 * Widening by 110 m keeps every orthometric height inside the derived ellipsoidal bounds.
 */
export const GEOID_UNDULATION_MARGIN = 110;

/**
 * Ellipsoidal height range in metres assumed for the terrain surface when a `GROUND` extent has no
 * `groundElevation`, or when the reference is `LOCAL`.
 *
 * It encloses every land surface: the Dead Sea shore lies near -430 m and Mount Everest near +8849 m
 * orthometric height, both within the geoid undulation range of this interval.
 */
export const UNKNOWN_GROUND_HEIGHT_RANGE: readonly [number, number] = [-500, 9000];

/** Horizontal sample count per axis. Three samples capture the curvature bulge at the extent centre. */
const SAMPLES_PER_AXIS = 3;

/** Ellipsoids of the horizontal datums recognized by `resolveUtmProjection`. */
const DATUM_ELLIPSOIDS: ReadonlyMap<string, Ellipsoid> = new Map([
    ["WGS 84", Ellipsoid.WGS84],
    ["NAD83", Ellipsoid.GRS80],
    ["NAD83(CSRS)", Ellipsoid.GRS80],
    ["ETRS89", Ellipsoid.GRS80],
]);

/**
 * Transformations to WGS 84 published by the EPSG registry, or documented null transformations.
 *
 * Exact transformations between these datums are time dependent: they require a coordinate epoch and a
 * 14-parameter Helmert transformation through ITRF. The extension does not carry a coordinate epoch, so
 * the published null transformations are used and their full error is covered by `accuracy`.
 */
const WGS84_TRANSFORMATIONS: ReadonlyMap<string, IHorizontalDatumTransformation> = new Map([
    ["WGS 84", { name: "identity", accuracy: 0 }],
    ["NAD83", { name: "EPSG:1188 NAD83 to WGS 84 (1), null transformation", accuracy: 4 }],
    ["ETRS89", { name: "EPSG:1149 ETRS89 to WGS 84 (1), null transformation", accuracy: 1 }],
    [
        "NAD83(CSRS)",
        { name: "NAD83(CSRS) to WGS 84 null transformation, epoch-dependent ITRF offset of up to 2 m not modelled", accuracy: 2 },
    ],
]);

/**
 * Default datum resolver, targeting WGS 84.
 *
 * Returns `undefined` for extents whose datum is unknown, for example a zone without an EPSG code
 * or an unrecognized EPSG code. Such extents are reported as `unresolved-datum` and are not placed.
 * Supply another resolver to place them, or when the spatial metric does not use WGS 84.
 */
export function defaultHorizontalDatumResolver(projection: IUtmProjection): IHorizontalDatumTransformation | undefined {
    return projection.datum === undefined ? undefined : WGS84_TRANSFORMATIONS.get(projection.datum);
}

interface IVerticalModel {
    origin: UtmVerticalOrigin;
    /** Height interval in metres, ellipsoidal or orthometric depending on `orthometric`. */
    range: [number, number];
    orthometric: boolean;
}

/** Converts signed vertical values to an interval measured upward from the vertical origin. */
function upwardInterval(vertical: IVerticalExtent): [number, number] {
    return vertical.direction === "DOWN" ? [-vertical.maximum, -vertical.minimum] : [vertical.minimum, vertical.maximum];
}

function verticalModel(vertical: IVerticalExtent): IVerticalModel {
    const [lower, upper] = upwardInterval(vertical);
    switch (vertical.reference) {
        case "ELLIPSOID":
            return { origin: "ellipsoid", range: [lower, upper], orthometric: false };
        case "GEOID":
            return { origin: "geoid", range: [lower, upper], orthometric: true };
        case "GROUND":
            if (vertical.groundElevation !== undefined) {
                return {
                    origin: "ground-elevation",
                    range: [vertical.groundElevation + lower, vertical.groundElevation + upper],
                    orthometric: true,
                };
            }
            break;
    }
    return {
        origin: "assumed-terrain",
        range: [UNKNOWN_GROUND_HEIGHT_RANGE[0] + lower, UNKNOWN_GROUND_HEIGHT_RANGE[1] + upper],
        orthometric: false,
    };
}

/**
 * Derives the ellipsoidal height interval of a vertical extent without a geoid model.
 *
 * Orthometric and ground-anchored values are widened by {@link GEOID_UNDULATION_MARGIN}. Ground values
 * without `groundElevation` and `LOCAL` values use {@link UNKNOWN_GROUND_HEIGHT_RANGE}.
 *
 * @param vertical - Vertical extent of a UTM bounding volume.
 * @returns Minimum and maximum ellipsoidal heights in metres.
 */
export function ellipsoidalHeightRange(vertical: IVerticalExtent): [number, number] {
    const model = verticalModel(vertical);
    return model.orthometric ? [model.range[0] - GEOID_UNDULATION_MARGIN, model.range[1] + GEOID_UNDULATION_MARGIN] : model.range;
}

/** ECEF bounds of a UTM extent together with the report of how they were derived. */
export interface IUtmBounds extends EcefBounds {
    placement: IUtmPlacement;
}

function widen(bounds: EcefBounds, margin: number): EcefBounds {
    if (margin <= 0 || !bounds.boundingBox || !bounds.boundingSphere) return bounds;
    const { min, max } = bounds.boundingBox;
    return {
        boundingBox: {
            min: { x: min.x - margin, y: min.y - margin, z: min.z - margin },
            max: { x: max.x + margin, y: max.y + margin, z: max.z + margin },
        },
        boundingSphere: { center: bounds.boundingSphere.center, radius: bounds.boundingSphere.radius + margin },
    };
}

/**
 * Derives ECEF bounds from a `SPACEXR_bounding_volume_utm` extent.
 *
 * 1. The zone, hemisphere and datum are resolved from the EPSG code or the explicit zone.
 * 2. The UTM grid is inverted on the ellipsoid of the datum.
 * 3. The datum transformation is applied, and the bounds are widened by its accuracy.
 * 4. Heights are converted to ellipsoidal heights with the geoid model, or widened by a geoid margin.
 * 5. A 3 x 3 grid of the extent at both heights is converted to ECEF with `system`.
 *
 * Every step is reported in `placement`. When the projection or the datum cannot be resolved, no bounds are derived.
 *
 * @param extent - UTM extent.
 * @param system - Geodetic system of the ECEF frame.
 * @param options - Datum resolver and geoid model.
 * @returns ECEF bounds and the placement report.
 */
export function boundsFromUtm(extent: IUtmBoundingVolume, system: GeodeticSystem, options: IUtmPlacementOptions = {}): IUtmBounds {
    const projection = resolveUtmProjection(extent);
    if (!projection) return { placement: { status: "unresolved-projection", horizontalMargin: 0, verticalMargin: 0 } };

    const datumTransformation = (options.datumResolver ?? defaultHorizontalDatumResolver)(projection);
    if (!datumTransformation) return { placement: { status: "unresolved-datum", projection, horizontalMargin: 0, verticalMargin: 0 } };

    const vertical = verticalModel(extent.vertical);
    const geoid = vertical.orthometric ? (options.geoidUndulation ? "model" : "margin") : undefined;
    const verticalMargin = geoid === "margin" ? GEOID_UNDULATION_MARGIN : 0;
    const minimumHeight = vertical.range[0] - verticalMargin;
    const maximumHeight = vertical.range[1] + verticalMargin;

    const ellipsoid = (projection.datum === undefined ? undefined : DATUM_ELLIPSOIDS.get(projection.datum)) ?? system.ellipsoid;
    const utm = new UtmProjection(projection.zone, projection.hemisphere, ellipsoid);
    const points: IVector3[] = [];
    const geodetic = { latitude: 0, longitude: 0, height: 0 };
    for (let i = 0; i < SAMPLES_PER_AXIS; i++) {
        const easting = extent.minEasting + ((extent.maxEasting - extent.minEasting) * i) / (SAMPLES_PER_AXIS - 1);
        for (let j = 0; j < SAMPLES_PER_AXIS; j++) {
            const northing = extent.minNorthing + ((extent.maxNorthing - extent.minNorthing) * j) / (SAMPLES_PER_AXIS - 1);
            utm.projectedToGeodeticRadians(easting, northing, 0, geodetic);
            datumTransformation.transform?.(geodetic);
            const undulation = geoid === "model" ? options.geoidUndulation!(geodetic.latitude, geodetic.longitude) : 0;
            points.push(system.geodeticRadiansToEcef(geodetic.latitude, geodetic.longitude, minimumHeight + undulation));
            points.push(system.geodeticRadiansToEcef(geodetic.latitude, geodetic.longitude, maximumHeight + undulation));
        }
    }

    const placement: IUtmPlacement = {
        status: "placed",
        projection,
        datumTransformation: { name: datumTransformation.name, accuracy: datumTransformation.accuracy },
        horizontalMargin: datumTransformation.accuracy,
        verticalOrigin: vertical.origin,
        verticalMargin,
        heightRange: [minimumHeight, maximumHeight],
    };
    if (geoid) placement.geoid = geoid;
    return { ...widen(boundsFromPoints(points), datumTransformation.accuracy), placement };
}
