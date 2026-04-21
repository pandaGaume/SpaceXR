import type * as BABYLON from "@babylonjs/core";
import type { Ellipsoid, GeodeticSystem } from "core/geodesy";
import type { IGeo3 } from "core/geography";

/**
 * Camera capable of being driven in geodetic coordinates (latitude, longitude, altitude)
 * around an arbitrary reference ellipsoid. The implementation is expected to keep a
 * consistent ECEF anchor (center) plus camera-relative yaw/pitch/radius while exposing
 * high level navigation helpers in degrees / meters.
 */
export interface IGeodeticCamera extends IGeo3 {
    /** Reference ellipsoid used for geodetic conversions. */
    readonly ellipsoid: Ellipsoid;

    /** Geodetic system wrapping the ellipsoid (and optional ENU anchor). */
    readonly system: GeodeticSystem;

    /**
     * Current geodetic position of the camera eye (lat, lon, alt), recomputed from the
     * current world-space eye position.
     */
    readonly geodeticPosition: IGeo3;

    /**
     * Teleport the camera anchor to the given geodetic position and orient it using
     * the supplied yaw / pitch. altitude is the distance between the camera eye and
     * the anchor on the ellipsoid (i.e. the GeospatialCamera radius above ground).
     */
    setGeodeticPosition(lat: number, lon: number, altitude: number, yaw?: number, pitch?: number): void;

    /**
     * Smoothly animate the camera to the given geodetic destination.
     */
    flyToGeodeticAsync(lat: number, lon: number, altitude: number, yaw?: number, pitch?: number, durationMs?: number, easing?: BABYLON.EasingFunction): Promise<void>;
}

/** Runtime type guard for {@link IGeodeticCamera}. */
export function IsGeodeticCamera(b: unknown): b is IGeodeticCamera {
    if (typeof b !== "object" || b === null) {
        return false;
    }
    const c = b as IGeodeticCamera;
    return (
        typeof c.lat === "number" &&
        typeof c.lon === "number" &&
        typeof c.setGeodeticPosition === "function" &&
        typeof c.flyToGeodeticAsync === "function" &&
        c.system !== undefined &&
        c.ellipsoid !== undefined
    );
}
