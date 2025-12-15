import * as BABYLON from "@babylonjs/core";

import { ICartesian3, IPlane, IQuaternion } from "core/geometry";
import { ICameraViewState } from "core/tiles";

export class CameraState implements ICameraViewState {
    private static _cachedMatrix = new BABYLON.Matrix();
    private static _cachedQuaternion = new BABYLON.Quaternion();

    /** Perspective FOV (Y). Returns 0 for orthographic cameras. */
    public static GetFovY(camera: BABYLON.Camera): number {
        return camera.mode === BABYLON.Camera.PERSPECTIVE_CAMERA ? (camera as any).fov ?? 0 : 0;
    }

    /**
     * Extract world rotation as quaternion without per-frame allocations.
     * Writes into `ref` and returns it.
     */
    public static GetWorldRotationToRef(camera: BABYLON.Camera, ref: BABYLON.Quaternion): BABYLON.Quaternion {
        const wm = camera.getWorldMatrix();
        wm.getRotationMatrixToRef(CameraState._cachedMatrix);
        BABYLON.Quaternion.FromRotationMatrixToRef(CameraState._cachedMatrix, ref);
        return ref;
    }
    /**
     * Update the provided `state` from `cam` (no allocations on hot path).
     * Returns the same `state` for chaining.
     */
    public static UpdateToRef(cam: BABYLON.Camera, state: ICameraViewState): ICameraViewState {
        // Keep matrices coherent (cheap if nothing changed)
        if ((cam as any).rebuildAnglesAndRadius instanceof Function) {
            (cam as any).rebuildAnglesAndRadius();
        }
        cam.computeWorldMatrix();

        // ---- Pose ----
        const pos = cam.globalPosition;
        CameraState.GetWorldRotationToRef(cam, CameraState._cachedQuaternion);

        // ---- Intrinsics ----
        const fov = CameraState.GetFovY(cam);
        const engine = cam.getScene().getEngine();
        const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
        const near = cam.minZ;
        const far = cam.maxZ;
        const up = cam.upVector;

        // ---- ViewProj + Frustum (robust path for all cameras) ----
        // Ask Babylon for its warmed view*proj (includes inertia etc.)
        // Note: getTransformationMatrix() = view * projection
        const vp = cam.getTransformationMatrix();
        const planes = BABYLON.Frustum.GetPlanes(vp);

        // ---- Write to state (reuse if the implementer provided mutable vectors) ----
        // Position
        if ((state.worldPosition as any)?.copyFrom) {
            (state.worldPosition as any).copyFrom(pos);
        } else {
            state.worldPosition = pos.clone();
        }

        // Rotation
        if ((state.worldRotation as any)?.copyFrom) {
            (state.worldRotation as any).copyFrom(CameraState._cachedQuaternion);
        } else {
            state.worldRotation = CameraState._cachedQuaternion.clone();
        }

        // Up (optional)
        if (state.up) {
            (state.up as any).copyFrom?.(up) ?? (state.up = up.clone());
        } else {
            state.up = up.clone();
        }

        state.fovY = fov;
        state.tanFov2 = fov > 0 ? Math.tan(fov * 0.5) : 0;
        state.aspect = aspect;
        state.near = near;
        state.far = far;

        // ViewProjection
        if (state.viewProjection) {
            (state.viewProjection as BABYLON.Matrix).copyFrom(vp);
        } else {
            state.viewProjection = vp.clone();
        }

        // Frustum planes (copy to consumer type if needed)
        // If IPlane is structurally compatible with BABYLON.Plane, we can assign directly.
        state.frustumPlanes = planes as unknown as IPlane[];

        return state;
    }

    worldPosition: ICartesian3 = BABYLON.Vector3.Zero();
    worldRotation: IQuaternion = BABYLON.Quaternion.Identity();
    fovY: number = 0;
    tanFov2: number = 0;
    frustumPlanes?: IPlane[];
    viewProjection?: BABYLON.Matrix;
    aspect?: number;
    near?: number;
    far?: number;
    up?: ICartesian3;
}
