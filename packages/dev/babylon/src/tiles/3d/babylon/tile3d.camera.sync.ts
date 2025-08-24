import * as BABYLON from "@babylonjs/core";
import { CameraStateListener } from "core/tiles";

export function SetupCameraStateSync(scene: BABYLON.Scene, camera: BABYLON.Camera, onState: CameraStateListener, eps = 1e-6): BABYLON.IDisposable {
    let viewDirty = true;
    let projDirty = true;

    // last emitted
    let lastPos = new BABYLON.Vector3(Number.NaN, Number.NaN, Number.NaN);
    let lastRot = new BABYLON.Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    let lastFov = Number.NaN;

    // mark dirty when something relevant changes
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
            Number.isNaN(rot.x) ||
            Number.isNaN(rot.y) ||
            Number.isNaN(rot.z) ||
            Number.isNaN(rot.w);

        const fovChanged = Math.abs(fov - lastFov) > eps || Number.isNaN(lastFov);

        if (posChanged || rotChanged || fovChanged) {
            lastPos.copyFrom(pos);
            lastRot.copyFrom(rot);
            lastFov = fov;

            onState({
                worldPosition: pos.clone(),
                worldRotation: rot.clone(),
                fovY: fov,
                tanFov2: fov > 0 ? Math.tan(fov * 0.5) : 0,
                frustumPlanes: BABYLON.Frustum.GetPlanes(camera.getTransformationMatrix()),
            });
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

    // Attach to initial camera (if any)
    if (current) {
        currentSync = SetupCameraStateSync(scene, current, onState, eps);
    }

    // React to active camera changes
    const camChangedObs = scene.onActiveCameraChanged.add(() => {
        const next = scene.activeCamera ?? null;
        if (next === current) return;

        // Tear down previous sync
        if (currentSync) {
            currentSync.dispose();
            currentSync = null;
        }

        current = next;

        // Attach to new active camera
        if (current) {
            currentSync = SetupCameraStateSync(scene, current, onState, eps);
        }
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
