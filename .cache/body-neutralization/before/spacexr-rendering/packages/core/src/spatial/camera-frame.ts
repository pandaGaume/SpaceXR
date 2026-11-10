import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { Frustum } from "@babylonjs/core/Maths/math.frustum.js";
import { Matrix } from "@babylonjs/core/Maths/math.vector.js";
import type { Plane } from "@babylonjs/core/Maths/math.plane.js";
import type { IEcefCameraFrame, IPlane } from "@spacexr/3d-tiles-runtime";

function planeToRuntimePlane(plane: Plane): IPlane {
    return { x: plane.normal.x, y: plane.normal.y, z: plane.normal.z, w: plane.d };
}

/** Options of {@link createEcefCameraFrame}. */
export interface IEcefCameraFrameOptions {
    /**
     * Periphery of the view, where tiles stay active without being visible, as a fraction of the half extent of the view.
     * Tiles are selected for a camera that has already moved when they are drawn, so without a periphery the edges of the
     * image lack terrain while the camera turns. Defaults to 0: no periphery.
     */
    frustumMargin?: number;
}

/** View and projection of a camera, the projection widened by a margin. */
function cullingTransform(camera: Camera, margin: number): Matrix {
    const projection = Array.from(camera.getProjectionMatrix().m);
    projection[0]! /= 1 + margin;
    projection[5]! /= 1 + margin;
    return camera.getViewMatrix().multiply(Matrix.FromArray(projection));
}

/**
 * Captures a Babylon camera as the renderer-neutral ECEF camera frame. The scene must use ECEF world coordinates,
 * which `useLargeWorldRendering` keeps precise on the GPU.
 */
export function createEcefCameraFrame(camera: Camera, engine: AbstractEngine, options: IEcefCameraFrameOptions = {}): IEcefCameraFrame {
    const margin = options.frustumMargin ?? 0;
    return {
        id: camera.id,
        position: {
            x: camera.globalPosition.x,
            y: camera.globalPosition.y,
            z: camera.globalPosition.z,
        },
        viewportHeight: engine.getRenderHeight() * camera.viewport.height,
        verticalFovRadians: camera.fov,
        frustumPlanes: Frustum.GetPlanes(camera.getTransformationMatrix()).map(planeToRuntimePlane),
        ...(margin > 0 ? { peripheryFrustumPlanes: Frustum.GetPlanes(cullingTransform(camera, margin)).map(planeToRuntimePlane) } : {}),
        timestamp: performance.now(),
    };
}
