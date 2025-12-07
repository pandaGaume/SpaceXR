import * as BABYLON from "@babylonjs/core";
import { CameraStateListener } from "core/tiles";
import { CameraMotionDetector } from ".";

declare module "core/tiles/navigation/tiles.navigation.interfaces" {
    export interface ICameraViewState {
        viewProjection?: BABYLON.Matrix;
    }
}

function initCameraSync(camera: BABYLON.Camera) {
    // ArcRotate-only: ensure position/target/radius ⇄ alpha/beta are coherent
    if ((camera as any).rebuildAnglesAndRadius instanceof Function) {
        (camera as any).rebuildAnglesAndRadius();
    }
    // Force a world matrix (safe; doesn’t force fragile view path)
    camera.computeWorldMatrix();
    // Warm up projection (safe)
    camera.getProjectionMatrix(true);
}

/** Build view-projection and frustum without touching fragile code paths on first frame. */
function getViewProjAndFrustumSafe(camera: BABYLON.Camera) {
    const engine = camera.getScene().getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());

    let view: BABYLON.Matrix;
    let proj: BABYLON.Matrix;

    if (camera.mode === BABYLON.Camera.PERSPECTIVE_CAMERA) {
        if (camera instanceof BABYLON.ArcRotateCamera) {
            // Compute a stable view from ArcRotate fields
            const pos = camera.position;
            const tgt = camera.target;
            const up = camera.upVector;
            view = BABYLON.Matrix.LookAtLH(pos, tgt, up);
            proj = BABYLON.Matrix.PerspectiveFovLH(camera.fov, aspect, camera.minZ, camera.maxZ);
        } else {
            // For other camera types, rely on Babylon once matrices are warm
            // Ensure we at least have a world matrix and proj first:
            camera.computeWorldMatrix();
            camera.getProjectionMatrix(false);
            // Now we can fetch the full transform:
            // (this is view * proj)
            const vp = camera.getTransformationMatrix();
            // Split if you need separate view/proj (optional):
            // We’ll just use vp for frustum below.
            const frustumPlanes = BABYLON.Frustum.GetPlanes(vp);
            return { viewProj: vp, frustumPlanes };
        }
    } else {
        // Orthographic: defer to Babylon’s transform (most robust)
        camera.computeWorldMatrix();
        const vp = camera.getTransformationMatrix();
        const frustumPlanes = BABYLON.Frustum.GetPlanes(vp);
        return { viewProj: vp, frustumPlanes };
    }

    const viewProj = view.multiply(proj);
    const frustumPlanes = BABYLON.Frustum.GetPlanes(viewProj);
    return { viewProj, frustumPlanes };
}

export function SetupCameraStateSync(camera: BABYLON.Camera | CameraMotionDetector, onState: CameraStateListener, eps = 1e-6): BABYLON.IDisposable {
    const cam = camera instanceof BABYLON.Camera ? camera : camera.camera;
    // One-time stabilization right after creation
    initCameraSync(cam);

    let viewDirty = true;
    let projDirty = true;

    // last emitted
    let lastPos = new BABYLON.Vector3(Number.NaN, Number.NaN, Number.NaN);
    let lastRot = new BABYLON.Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    let lastFov = Number.NaN;

    const vObs = cam.onViewMatrixChangedObservable.add(() => {
        viewDirty = true;
    });
    const pObs = cam.onProjectionMatrixChangedObservable.add(() => {
        projDirty = true;
    });
    const aObs = cam.onAfterCheckInputsObservable.add(() => {
        viewDirty = true;
    });

    const getWorldRotation = (): BABYLON.Quaternion => {
        // World matrix is already safe due to init + onBeforeRender cadence
        const wm = cam.getWorldMatrix();
        const rotM = new BABYLON.Matrix();
        wm.getRotationMatrixToRef(rotM);
        const q = new BABYLON.Quaternion();
        BABYLON.Quaternion.FromRotationMatrixToRef(rotM, q);
        return q;
    };

    const getFovY = (): number => (cam.mode === BABYLON.Camera.PERSPECTIVE_CAMERA ? cam.fov : 0);

    const frameObs = cam.getScene().onBeforeRenderObservable.add(() => {
        if (!viewDirty && !projDirty) return;

        // Keep matrices coherent each frame (cheap no-ops if nothing changed)
        if ((cam as any).rebuildAnglesAndRadius instanceof Function) {
            (cam as any).rebuildAnglesAndRadius();
        }
        cam.computeWorldMatrix();

        const pos = cam.globalPosition;
        const rot = getWorldRotation();
        const fov = getFovY();

        const posChanged =
            Math.abs(pos.x - lastPos.x) > eps ||
            Math.abs(pos.y - lastPos.y) > eps ||
            Math.abs(pos.z - lastPos.z) > eps ||
            Number.isNaN(lastPos.x) ||
            Number.isNaN(lastPos.y) ||
            Number.isNaN(lastPos.z);

        const rotChanged =
            Math.abs(rot.x - lastRot.x) > eps ||
            Math.abs(rot.y - lastRot.y) > eps ||
            Math.abs(rot.z - lastRot.z) > eps ||
            Math.abs(rot.w - lastRot.w) > eps ||
            Number.isNaN(lastRot.x) ||
            Number.isNaN(lastRot.y) ||
            Number.isNaN(lastRot.z) ||
            Number.isNaN(lastRot.w);

        const fovChanged = Math.abs(fov - lastFov) > eps || Number.isNaN(lastFov);

        if (posChanged || rotChanged || fovChanged) {
            lastPos.copyFrom(pos);
            lastRot.copyFrom(rot);
            lastFov = fov;

            // Build frustum safely
            const { viewProj, frustumPlanes } = getViewProjAndFrustumSafe(cam);

            onState({
                worldPosition: pos.clone(),
                worldRotation: rot.clone(),
                fovY: fov,
                tanFov2: fov > 0 ? Math.tan(fov * 0.5) : 0,
                frustumPlanes,
                viewProjection: viewProj,
            } as any);
        }

        viewDirty = false;
        projDirty = false;
    });

    return {
        dispose() {
            cam.onViewMatrixChangedObservable.remove(vObs);
            cam.onProjectionMatrixChangedObservable.remove(pObs);
            cam.onAfterCheckInputsObservable.remove(aObs);
            cam.getScene()?.onBeforeRenderObservable.remove(frameObs);
        },
    } as BABYLON.IDisposable;
}
