import { GeospatialClippingBehavior } from "@babylonjs/core/Behaviors/Cameras/geospatialClippingBehavior.js";
import { GeospatialCamera } from "@babylonjs/core/Cameras/geospatialCamera.js";
// The camera picks the surface under the pointer to zoom and rotate around it, which needs rays.
import "@babylonjs/core/Culling/ray.js";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { GeodeticSystem } from "@spacexr/geodesy";

/** Geodetic position in degrees and ellipsoidal height in metres. */
export interface IGeodeticPositionDegrees {
    latitudeDegrees: number;
    longitudeDegrees: number;
    heightMeters?: number;
}

export interface IGeospatialCameraOptions {
    name?: string;
    /** Body the camera orbits. Defaults to WGS84. */
    geodeticSystem?: GeodeticSystem;
    /** Point the camera orbits around. */
    target: IGeodeticPositionDegrees;
    /** Distance to the target in metres. */
    radius: number;
    /** Defaults to 30 degrees. */
    pitchRadians?: number;
    /** Defaults to 0, facing north. */
    yawRadians?: number;
    /** Defaults to 10 m. */
    radiusMin?: number;
    /** Defaults to twice the semi-major axis. */
    radiusMax?: number;
    /** Radius scales between which pitch control fades out. Defaults to 0.5 and 1.5. */
    pitchDisabledRadiusScale?: Vector2;
    /** Adds `GeospatialClippingBehavior`, which adapts near and far planes to the altitude. Defaults to true. */
    clipping?: boolean;
    /** Attaches pointer and keyboard controls. Defaults to true. */
    attachControl?: boolean;
}

/**
 * Makes the camera use the geodetic surface normal of the ellipsoid as its up vector, instead of the geocentric
 * direction of a sphere. On WGS84 the two differ by up to 0.19 degrees.
 */
export function useEllipsoidUpVector(camera: GeospatialCamera, geodeticSystem: GeodeticSystem = GeodeticSystem.WGS84): void {
    camera.movement.calculateUpVectorFromPointToRef = (point, result) => {
        const geodetic = geodeticSystem.ecefToGeodeticRadians(point);
        const normal = geodeticSystem.geodeticSurfaceNormalRadians(geodetic.latitude, geodetic.longitude);
        return result.set(normal.x, normal.y, normal.z);
    };
}

/** Creates a Babylon `GeospatialCamera` orbiting a geodetic target, with ellipsoid-aware navigation. */
export function createGeospatialCamera(scene: Scene, options: IGeospatialCameraOptions): GeospatialCamera {
    const geodeticSystem = options.geodeticSystem ?? GeodeticSystem.WGS84;
    const { latitudeDegrees, longitudeDegrees, heightMeters = 0 } = options.target;
    const center = geodeticSystem.geodeticDegreesToEcef(latitudeDegrees, longitudeDegrees, heightMeters);

    const camera = new GeospatialCamera(options.name ?? "geospatial-camera", scene, {
        planetRadius: geodeticSystem.ellipsoid.semiMajorAxis,
    });
    useEllipsoidUpVector(camera, geodeticSystem);
    camera.limits.radiusMin = options.radiusMin ?? 10;
    camera.limits.radiusMax = options.radiusMax ?? geodeticSystem.ellipsoid.semiMajorAxis * 2;
    camera.limits.pitchDisabledRadiusScale = options.pitchDisabledRadiusScale ?? new Vector2(0.5, 1.5);
    camera.center = new Vector3(center.x, center.y, center.z);
    camera.radius = options.radius;
    camera.pitch = options.pitchRadians ?? Math.PI / 6;
    camera.yaw = options.yawRadians ?? 0;
    if (options.clipping ?? true) camera.addBehavior(new GeospatialClippingBehavior());
    if (options.attachControl ?? true) camera.attachControl(true);
    return camera;
}
