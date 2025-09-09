import * as BABYLON from "@babylonjs/core";
import { CameraStateListener } from "core/tiles";

function initCameraSync(camera: BABYLON.Camera, scene: BABYLON.Scene) {
    // Make sure the scene has an active camera
    if (scene.activeCamera !== camera) {
        scene.activeCamera = camera;
    }
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
function getViewProjAndFrustumSafe(camera: BABYLON.Camera, scene: BABYLON.Scene) {
    const engine = scene.getEngine();
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

export function SetupCameraStateSync(camera: BABYLON.Camera, scene: BABYLON.Scene, onState: CameraStateListener, eps = 1e-6): BABYLON.IDisposable {
    // One-time stabilization right after creation
    initCameraSync(camera, scene);

    let viewDirty = true;
    let projDirty = true;

    // last emitted
    let lastPos = new BABYLON.Vector3(Number.NaN, Number.NaN, Number.NaN);
    let lastRot = new BABYLON.Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    let lastFov = Number.NaN;

    const vObs = camera.onViewMatrixChangedObservable.add(() => {
        viewDirty = true;
    });
    const pObs = camera.onProjectionMatrixChangedObservable.add(() => {
        projDirty = true;
    });
    const aObs = camera.onAfterCheckInputsObservable.add(() => {
        viewDirty = true;
    });

    const getWorldRotation = (): BABYLON.Quaternion => {
        // World matrix is already safe due to init + onBeforeRender cadence
        const wm = camera.getWorldMatrix();
        const rotM = new BABYLON.Matrix();
        wm.getRotationMatrixToRef(rotM);
        const q = new BABYLON.Quaternion();
        BABYLON.Quaternion.FromRotationMatrixToRef(rotM, q);
        return q;
    };

    const getFovY = (): number => (camera.mode === BABYLON.Camera.PERSPECTIVE_CAMERA ? camera.fov : 0);

    const frameObs = scene.onBeforeRenderObservable.add(() => {
        if (!viewDirty && !projDirty) return;

        // Keep matrices coherent each frame (cheap no-ops if nothing changed)
        if ((camera as any).rebuildAnglesAndRadius instanceof Function) {
            (camera as any).rebuildAnglesAndRadius();
        }
        camera.computeWorldMatrix();

        const pos = camera.globalPosition;
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
            const { viewProj, frustumPlanes } = getViewProjAndFrustumSafe(camera, scene);

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
            camera.onViewMatrixChangedObservable.remove(vObs);
            camera.onProjectionMatrixChangedObservable.remove(pObs);
            camera.onAfterCheckInputsObservable.remove(aObs);
            scene.onBeforeRenderObservable.remove(frameObs);
        },
    } as BABYLON.IDisposable;
}

export function SyncActiveCameraState(scene: BABYLON.Scene, onState: CameraStateListener, eps = 1e-6): BABYLON.IDisposable {
    let current: BABYLON.Camera | null = scene.activeCamera ?? null;
    let currentSync: BABYLON.IDisposable | null = null;

    if (current) {
        currentSync = SetupCameraStateSync(current, scene, onState, eps);
    }

    const camChangedObs = scene.onActiveCameraChanged.add(() => {
        const next = scene.activeCamera ?? null;
        if (next === current) return;

        if (currentSync) {
            currentSync.dispose();
            currentSync = null;
        }
        current = next;
        if (current) currentSync = SetupCameraStateSync(current, scene, onState, eps);
    });

    return {
        dispose() {
            if (currentSync) {
                currentSync.dispose();
                currentSync = null;
            }
            scene.onActiveCameraChanged.remove(camChangedObs);
        },
    };
}
