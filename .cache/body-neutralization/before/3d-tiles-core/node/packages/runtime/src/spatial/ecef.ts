import { getUtmBoundingVolume } from "@spacexr/3d-tiles-core";
import { GeodeticSystem } from "@spacexr/geodesy";

import type { IScreenSpaceErrorContext, ISpatialDerivationContext, ISpatialMetric } from "../ports/spatial";
import {
    boundsFromBox,
    boundsFromRegion,
    boundsFromSphere,
    boxesIntersect,
    isSphereBelowConservativeHorizon,
    isSphereBeyondHorizon,
    sphereOutsidePlane,
} from "./bounding-volumes";
import type { IEcefCameraFrame, IEcefSpatialMetricOptions, IEcefSpatialState } from "./ecef-types";
import { placeVertically, type IVerticalPlacement } from "./vertical-scale";
import { boundsFromUtm } from "./utm-bounds";
import type { IUtmPlacementOptions } from "./utm-types";
import { matrixOf, maximumScale, multiplyTransforms, vectorLength } from "./matrix";

const DEFAULT_VIEWPORT_HEIGHT = 1080;
const DEFAULT_VERTICAL_FOV_RADIANS = Math.PI / 3;

/**
 * Renderer-neutral 3D Tiles spatial metric operating in ECEF metres.
 *
 * The class owns 3D Tiles concerns such as transform composition, bounding
 * volume derivation, visibility and screen-space error. Ellipsoid and
 * coordinate-system mathematics are delegated to `@spacexr/geodesy`.
 */
export class EcefSpatialMetric implements ISpatialMetric<IEcefCameraFrame, IEcefSpatialState> {
    private readonly system: GeodeticSystem;
    private readonly horizonCulling: boolean;
    private readonly horizon: "plane" | "tile-heights";
    /** Lowest terrain measured on any tile so far, over the reference surface, in metres. */
    /** Lowest terrain measured, without the vertical scale, which may change later. */
    private lowestUnscaledHeight = 0;
    private readonly defaultViewportHeight: number;
    private readonly defaultVerticalFovRadians: number;
    private readonly utmOptions: IUtmPlacementOptions;
    private readonly vertical: IVerticalPlacement | undefined;

    /**
     * Creates an ECEF spatial metric.
     *
     * @param options - Geodetic system and camera fallbacks.
     */
    public constructor(options: IEcefSpatialMetricOptions = {}) {
        this.system = options.geodeticSystem ?? GeodeticSystem.WGS84;
        this.horizonCulling = options.horizonCulling ?? true;
        this.horizon = options.horizon ?? "plane";
        this.defaultViewportHeight = options.defaultViewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;
        this.defaultVerticalFovRadians = options.defaultVerticalFovRadians ?? DEFAULT_VERTICAL_FOV_RADIANS;
        this.utmOptions = options.utm ?? {};
        this.vertical = options.vertical;

        if (!Number.isFinite(this.defaultViewportHeight) || this.defaultViewportHeight <= 0) {
            throw new RangeError("The default viewport height must be a positive finite number.");
        }
        if (
            !Number.isFinite(this.defaultVerticalFovRadians) ||
            this.defaultVerticalFovRadians <= 0 ||
            this.defaultVerticalFovRadians >= Math.PI
        ) {
            throw new RangeError("The default vertical field of view must be in the interval (0, PI).");
        }
    }

    /** Geodetic reference system used for regions and horizon culling. */
    public get geodeticSystem(): GeodeticSystem {
        return this.system;
    }

    /**
     * Derives world-space state for a tile.
     *
     * Box and sphere volumes receive the accumulated tile transform. A region
     * is already expressed in the tileset geodetic reference system and is not
     * transformed, as required by 3D Tiles. A `SPACEXR_bounding_volume_utm`
     * extent is likewise absolute: it takes precedence over any standard
     * fallback volume and ignores the tile transform. Its datum
     * transformation, geoid handling and margins are reported in
     * `utmPlacement`. When it cannot be placed, the standard volume is used
     * if present; otherwise the state has no bounds and the tile is never culled.
     *
     * @param context - Source tile and optional parent spatial state.
     * @returns Spatial state expressed in ECEF metres.
     */
    public derive(context: ISpatialDerivationContext<IEcefSpatialState>): IEcefSpatialState {
        const unscaled = this.deriveUnscaled(context);
        const state = context.heightRange ? { ...unscaled, heightRange: context.heightRange } : unscaled;
        if (context.heightRange) {
            const scale = this.vertical?.scale.value ?? 1;
            if (scale > 0) this.lowestUnscaledHeight = Math.min(this.lowestUnscaledHeight, context.heightRange[0] / scale);
        }
        return this.vertical ? placeVertically(state, this.vertical, context.parent) : state;
    }

    private deriveUnscaled(context: ISpatialDerivationContext<IEcefSpatialState>): IEcefSpatialState {
        const localTransform = matrixOf(context.tile.transform);
        const worldTransform = context.parent ? multiplyTransforms(context.parent.worldTransform, localTransform) : localTransform;
        const scale = maximumScale(worldTransform);
        const volume = context.tile.boundingVolume;
        const utm = getUtmBoundingVolume(volume);
        const utmBounds = utm ? boundsFromUtm(utm, this.system, this.utmOptions) : undefined;
        const standardBounds = volume.box
            ? boundsFromBox(volume.box, worldTransform)
            : volume.sphere
              ? boundsFromSphere(volume.sphere, worldTransform)
              : volume.region
                ? boundsFromRegion(volume.region, this.system)
                : {};

        if (utmBounds) {
            const { placement, ...placedBounds } = utmBounds;
            // An extent that cannot be placed falls back to the standard volume, if any; the report states why.
            const bounds = placement.status === "placed" ? placedBounds : standardBounds;
            return { worldTransform, ...bounds, geometricError: context.tile.geometricError * scale, utmPlacement: placement };
        }
        return {
            worldTransform,
            ...standardBounds,
            geometricError: context.tile.geometricError * scale,
        };
    }

    /**
     * Evaluates coarse clip bounds, conservative horizon culling and frustum planes.
     *
     * @param spatial - Derived tile state.
     * @param camera - Camera expressed in ECEF metres.
     * @returns `true` when the tile may contribute to the current view.
     */
    public isVisible(spatial: IEcefSpatialState, camera: IEcefCameraFrame): boolean {
        return this.isInside(spatial, camera, camera.frustumPlanes);
    }

    /**
     * Whether a tile is inside the wider planes around the view, with the same bounds and horizon as {@link isVisible}.
     *
     * @param spatial - Derived tile state.
     * @param camera - Camera expressed in ECEF metres.
     * @returns `true` when the camera has such planes and the tile may lie inside them.
     */
    public isInPeriphery(spatial: IEcefSpatialState, camera: IEcefCameraFrame): boolean {
        return camera.peripheryFrustumPlanes !== undefined && this.isInside(spatial, camera, camera.peripheryFrustumPlanes);
    }

    private isInside(spatial: IEcefSpatialState, camera: IEcefCameraFrame, planes: IEcefCameraFrame["frustumPlanes"]): boolean {
        if (camera.clipBounds && spatial.boundingBox && !boxesIntersect(spatial.boundingBox, camera.clipBounds)) return false;
        if (!spatial.boundingSphere) return true;
        if (this.horizonCulling) {
            const radius = this.system.ellipsoid.minimumRadius;
            const hidden =
                this.horizon === "tile-heights"
                    ? isSphereBeyondHorizon(
                          spatial.boundingSphere,
                          camera.position,
                          radius,
                          this.lowestUnscaledHeight * (this.vertical?.scale.value ?? 1),
                          spatial.heightRange,
                      )
                    : isSphereBelowConservativeHorizon(spatial.boundingSphere, camera.position, radius);
            if (hidden) return false;
        }
        if (planes?.some((plane) => sphereOutsidePlane(spatial.boundingSphere!, plane))) return false;
        return true;
    }

    /**
     * Computes projected geometric error in physical pixels.
     *
     * Distance is measured from the camera to the enclosing sphere surface,
     * not merely to its centre. This prevents premature refinement changes
     * near large tiles.
     *
     * @param context - Camera, tile and derived spatial state.
     * @returns Screen-space error in physical pixels.
     */
    public screenSpaceError(context: IScreenSpaceErrorContext<IEcefCameraFrame, IEcefSpatialState>): number {
        if (context.spatial.geometricError <= 0) return 0;
        const camera = context.camera;
        const sphere = context.spatial.boundingSphere;
        const distance = sphere
            ? Math.max(
                  vectorLength({
                      x: camera.position.x - sphere.center.x,
                      y: camera.position.y - sphere.center.y,
                      z: camera.position.z - sphere.center.z,
                  }) - sphere.radius,
                  Number.EPSILON,
              )
            : Math.max(vectorLength(camera.position), Number.EPSILON);
        const viewportHeight = camera.viewportHeight > 0 ? camera.viewportHeight : this.defaultViewportHeight;
        const tanHalfVerticalFov = camera.tanHalfVerticalFov ?? Math.tan((camera.verticalFovRadians ?? this.defaultVerticalFovRadians) / 2);
        if (!Number.isFinite(tanHalfVerticalFov) || tanHalfVerticalFov <= 0) return Number.POSITIVE_INFINITY;
        return (context.spatial.geometricError * viewportHeight) / (2 * tanHalfVerticalFov * distance);
    }
}
