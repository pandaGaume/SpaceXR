import * as BABYLON from "@babylonjs/core";
import { Ellipsoid, GeodeticSystem } from "core/geodesy";
import { Cartesian3 } from "core/geometry";
import { Geo3 } from "core/geography";
import type { IGeo3 } from "core/geography";

import type { IGeodeticCamera } from "./camera.Geodetic.interfaces";

/**
 * Additional options for {@link GeodeticCamera}, on top of the base Babylon
 * {@link BABYLON.GeospatialCameraOptions}. planetRadius is always derived from the
 * {@link GeodeticSystem} ellipsoid and therefore dropped from the options type; the
 * ellipsoid is the single source of truth for planetary scale.
 */
export type GeodeticCameraOptions = Omit<BABYLON.GeospatialCameraOptions, "planetRadius">;

/**
 * Babylon geospatial camera augmented with a {@link GeodeticSystem} for lat/lon/altitude
 * navigation on an arbitrary {@link Ellipsoid}.
 *
 * The base BABYLON.GeospatialCamera reasons in terms of an ECEF "center" anchor on the
 * globe plus yaw/pitch/radius. This class layers geodetic helpers on top so callers can
 * drive the camera using (lat, lon, alt) tuples without having to juggle ECEF math.
 */
export class GeodeticCamera extends BABYLON.GeospatialCamera implements IGeodeticCamera {
    private readonly _system: GeodeticSystem;

    // Scratch buffers to avoid allocation on hot paths (setGeodeticPosition, getters).
    private readonly _ecefScratch = Cartesian3.Zero();
    private readonly _geoScratch: IGeo3 = Geo3.Zero();
    private readonly _eyeScratch: BABYLON.Vector3 = BABYLON.Vector3.Zero();
    private readonly _centerScratch: BABYLON.Vector3 = BABYLON.Vector3.Zero();

    public constructor(name: string, scene: BABYLON.Scene, system: GeodeticSystem, options?: GeodeticCameraOptions) {
        super(name, scene, {
            planetRadius: system.ellipsoid.semiMajorAxis,
            pickPredicate: options?.pickPredicate,
        });
        this._system = system;
    }

    /** Reference ellipsoid used for geodetic conversions. */
    public get ellipsoid(): Ellipsoid {
        return this.system._ellipsoid;
    }

    /** Geodetic system wrapping the ellipsoid (and optional ENU anchor). */
    public get system(): GeodeticSystem {
        return this._system;
    }

    public get lat(): number {
        return this.geodeticPosition.lat;
    }

    public get lon(): number {
        return this.geodeticPosition.lon;
    }

    public get alt(): number | undefined {
        return this.geodeticPosition.alt;
    }

    public get hasAltitude(): boolean {
        return this.geodeticPosition.hasAltitude;
    }

    public equals(other: IGeo3 | undefined): boolean {
        return other !== undefined && this.geodeticPosition.equals(other);
    }

    /**
     * Clone the camera. A new GeodeticCamera is built with the same system and
     * pickPredicate as the current one, and the current view state (center, yaw,
     * pitch, radius) is copied onto it. The planetary radius is not carried over
     * explicitly because it is always derived from the ellipsoid held by the system.
     *
     * The dual signature is there to satisfy both contracts this class implements:
     * - IGeo3.clone(): IGeo3 (via IGeodeticCamera extends IGeo3). Callers that expect
     *   an IGeo3 snapshot get the clone upcast to IGeo3 (the cloned camera IS an IGeo3
     *   since GeodeticCamera implements IGeodeticCamera which extends IGeo3).
     * - BABYLON.Camera.clone(name, newParent?): Camera. Callers from the Babylon side
     *   pass a name and get back the same camera clone upcast to BABYLON.Camera.
     */
    public clone(): IGeo3;
    public clone(name: string, newParent?: BABYLON.Nullable<BABYLON.Node>): BABYLON.Camera;
    public clone(name?: string, newParent?: BABYLON.Nullable<BABYLON.Node>): IGeo3 | BABYLON.Camera {
        const copy = new GeodeticCamera(name ?? this.name, this.getScene(), this._system, {
            pickPredicate: this.movement.pickPredicate,
        });
        if (newParent !== undefined) {
            copy.parent = newParent;
        }
        copy.center = this.center;
        copy.yaw = this.yaw;
        copy.pitch = this.pitch;
        copy.radius = this.radius;
        return copy;
    }

    /**
     * Current geodetic position of the camera eye, recomputed on each access from
     * the camera world matrix. Note: the returned IGeo3 is a shared scratch object;
     * clone it if you need to retain the value.
     */
    public get geodeticPosition(): IGeo3 {
        // Derive the actual eye position from center + radius * (-lookAt) so that the
        // geodetic coordinates reflect the eye, not just the anchor point.
        this.getEyePositionToRef(this._eyeScratch);
        this._ecefScratch.x = this._eyeScratch.x;
        this._ecefScratch.y = this._eyeScratch.y;
        this._ecefScratch.z = this._eyeScratch.z;
        this._system.cartesianToGeodetic(this._ecefScratch, this._geoScratch);
        return this._geoScratch;
    }

    /**
     * Teleport the camera so that its anchor sits on the ellipsoid at (lat, lon) and
     * its eye sits altitude units above that anchor along the geocentric normal.
     */
    public setGeodeticPosition(lat: number, lon: number, altitude: number, yaw: number = this.yaw, pitch: number = this.pitch): void {
        this._system.geodeticFloatToCartesianToRef(lat, lon, 0, this._ecefScratch);
        this._centerScratch.set(this._ecefScratch.x, this._ecefScratch.y, this._ecefScratch.z);
        this.center = this._centerScratch;
        this.radius = altitude;
        this.yaw = yaw;
        this.pitch = pitch;
    }

    /**
     * Smoothly animate the camera to the given geodetic destination using the
     * underlying BABYLON.GeospatialCamera flyTo machinery.
     */
    public flyToGeodeticAsync(
        lat: number,
        lon: number,
        altitude: number,
        yaw: number = this.yaw,
        pitch: number = this.pitch,
        durationMs: number = 1000,
        easing?: BABYLON.EasingFunction
    ): Promise<void> {
        this._system.geodeticFloatToCartesianToRef(lat, lon, 0, this._ecefScratch);
        const targetCenter = new BABYLON.Vector3(this._ecefScratch.x, this._ecefScratch.y, this._ecefScratch.z);
        return this.flyToAsync(yaw, pitch, altitude, targetCenter, durationMs, easing);
    }

    /**
     * Writes the current eye world-space position into the supplied ref vector. The
     * base GeospatialCamera keeps this.position in sync with center/yaw/pitch/radius
     * via _getViewMatrix, so we force a view-matrix refresh to stay accurate even on
     * first access (before the first render tick).
     */
    public getEyePositionToRef(ref: BABYLON.Vector3): BABYLON.Vector3 {
        this.getViewMatrix(true);
        ref.copyFrom(this.position);
        return ref;
    }

    /** @internal */
    public override getClassName(): string {
        return "GeodeticCamera";
    }
}
