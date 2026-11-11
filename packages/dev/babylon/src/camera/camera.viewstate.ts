import * as BABYLON from "@babylonjs/core";

import { ICameraViewState } from "core/camera";
import { IBoundingBox, IBounds, ICartesian3, IPlane, IQuaternion } from "core/geometry";
import { IStreamEngine } from "core/streaming";
import { IDisposable, Nullable } from "core/types";

/**
 * Builds and refreshes an ICameraViewState from a Babylon camera.
 *
 * The state is a single mutable object refreshed in place by `update()`
 * (scratch-buffer discipline: no per-frame allocation). Consumers that need
 * to retain a snapshot must copy it.
 *
 * Coordinate convention: the state is expressed in Babylon WORLD coordinates,
 * untransformed. With the GeodeticCamera / BABYLON.GeospatialCamera setup
 * those coordinates ARE raw ECEF meters (planet centre at the origin), which
 * is exactly what the core streaming engines expect.
 */
export class CameraViewStateProvider implements IDisposable {
    private readonly _camera: BABYLON.Camera;
    private readonly _planes: Array<IPlane>;
    private _babylonPlanes: Nullable<Array<BABYLON.Plane>> = null;
    private readonly _state: ICameraViewState;

    public constructor(camera: BABYLON.Camera) {
        this._camera = camera;
        this._planes = [];
        for (let i = 0; i < 6; i++) {
            this._planes.push({ normal: { x: 0, y: 0, z: 0 }, d: 0 });
        }
        const worldPosition: ICartesian3 = { x: 0, y: 0, z: 0 };
        const worldRotation: IQuaternion = { x: 0, y: 0, z: 0, w: 1 };
        this._state = {
            worldPosition,
            worldRotation,
            fovY: camera.fov,
            tanFov2: Math.tan(camera.fov / 2),
            frustumPlanes: this._planes,
            isInFrustum: (bounds: IBounds) => this._isInFrustum(bounds),
        };
    }

    public get camera(): BABYLON.Camera {
        return this._camera;
    }

    /** The mutable state; refreshed by `update()`. */
    public get state(): ICameraViewState {
        return this._state;
    }

    /** Refreshes the state from the camera's current pose, optics and frustum. */
    public update(): ICameraViewState {
        const camera = this._camera;
        const engine = camera.getEngine();
        const state = this._state;

        const position = camera.globalPosition;
        state.worldPosition.x = position.x;
        state.worldPosition.y = position.y;
        state.worldPosition.z = position.z;

        const rotation = camera.absoluteRotation;
        state.worldRotation.x = rotation.x;
        state.worldRotation.y = rotation.y;
        state.worldRotation.z = rotation.z;
        state.worldRotation.w = rotation.w;

        const aspect = engine.getAspectRatio(camera);
        let fovY = camera.fov;
        if (camera.fovMode === BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED && aspect > 0) {
            fovY = 2 * Math.atan(Math.tan(camera.fov / 2) / aspect);
        }
        state.fovY = fovY;
        state.tanFov2 = Math.tan(fovY / 2);
        state.aspect = aspect;
        state.near = camera.minZ;
        state.far = camera.maxZ;
        state.viewportHeight = engine.getRenderHeight() * (camera.viewport?.height ?? 1);

        // Frustum planes from view * projection, converted to core IPlane
        // (same convention: inside iff dot(normal, p) + d >= 0).
        const transform = camera.getTransformationMatrix();
        if (!this._babylonPlanes) {
            this._babylonPlanes = BABYLON.Frustum.GetPlanes(transform);
        } else {
            BABYLON.Frustum.GetPlanesToRef(transform, this._babylonPlanes);
        }
        for (let i = 0; i < 6; i++) {
            const src = this._babylonPlanes[i];
            const dst = this._planes[i];
            dst.normal.x = src.normal.x;
            dst.normal.y = src.normal.y;
            dst.normal.z = src.normal.z;
            dst.d = src.d;
        }
        return state;
    }

    /** AABB vs frustum p-vertex test over the cached planes. Conservative. */
    private _isInFrustum(bounds: IBounds): boolean {
        for (let i = 0; i < 6; i++) {
            const plane = this._planes[i];
            const n = plane.normal;
            const px = n.x >= 0 ? bounds.maximum.x : bounds.minimum.x;
            const py = n.y >= 0 ? bounds.maximum.y : bounds.minimum.y;
            const pz = n.z >= 0 ? bounds.maximum.z : bounds.minimum.z;
            if (n.x * px + n.y * py + n.z * pz + plane.d < 0) return false;
        }
        return true;
    }

    public dispose(): void {
        this._babylonPlanes = null;
    }
}

export interface ICameraStreamPumpOptions {
    /** View id passed to the engine. Default "main". */
    viewId?: string;
    /** Optional clip bounds forwarded to the engine (holographic table clipping). */
    clipBounds?: IBoundingBox;
    /** Push the context every frame even when the camera has not moved. Default false. */
    alwaysUpdate?: boolean;
}

/**
 * Per-frame pump: on every scene render, reads the camera through a
 * CameraViewStateProvider and pushes the state into an IStreamEngine via
 * `setContext(viewId, state, clipBounds)`.
 *
 * By default the push is skipped while the camera transformation and
 * viewport are strictly unchanged (the engines re-traverse on every
 * setContext; async load completions are handled engine-side via
 * invalidate(), not by the pump). Use `forceRefresh()` to bypass the dirty
 * check once, e.g. after changing engine options.
 */
export class CameraStreamPump implements IDisposable {
    private readonly _scene: BABYLON.Scene;
    private readonly _engine: IStreamEngine;
    private readonly _provider: CameraViewStateProvider;
    private readonly _viewId: string;
    private readonly _alwaysUpdate: boolean;
    private _clipBounds?: IBoundingBox;
    private _observer: Nullable<BABYLON.Observer<BABYLON.Scene>>;
    // Float64: with `useHighPrecisionMatrix` Babylon stores matrices as float64,
    // and a float32 cache would round every entry, making the dirty check fire
    // on every frame.
    private readonly _lastTransform: Float64Array = new Float64Array(16).fill(Number.NaN);
    private _lastViewportHeight: number = Number.NaN;
    private _forceNext: boolean = true;

    public constructor(scene: BABYLON.Scene, camera: BABYLON.Camera, engine: IStreamEngine, options?: ICameraStreamPumpOptions) {
        this._scene = scene;
        this._engine = engine;
        this._provider = new CameraViewStateProvider(camera);
        this._viewId = options?.viewId ?? "main";
        this._clipBounds = options?.clipBounds;
        this._alwaysUpdate = options?.alwaysUpdate ?? false;
        this._observer = scene.onBeforeRenderObservable.add(() => this._tick());
    }

    public get provider(): CameraViewStateProvider {
        return this._provider;
    }

    public get viewId(): string {
        return this._viewId;
    }

    public get clipBounds(): IBoundingBox | undefined {
        return this._clipBounds;
    }

    /** Changing the clip bounds forces a re-push on the next frame. */
    public set clipBounds(value: IBoundingBox | undefined) {
        this._clipBounds = value;
        this._forceNext = true;
    }

    /** Bypasses the camera dirty check on the next frame. */
    public forceRefresh(): void {
        this._forceNext = true;
    }

    private _tick(): void {
        const camera = this._provider.camera;
        const m = camera.getTransformationMatrix().m;
        // Same quantity the provider publishes as viewportHeight, so a viewport
        // change is detected even at constant aspect ratio.
        const viewportHeight = camera.getEngine().getRenderHeight() * (camera.viewport?.height ?? 1);

        if (!this._alwaysUpdate && !this._forceNext) {
            let dirty = viewportHeight !== this._lastViewportHeight;
            if (!dirty) {
                for (let i = 0; i < 16; i++) {
                    if (m[i] !== this._lastTransform[i]) {
                        dirty = true;
                        break;
                    }
                }
            }
            // Budgeted engines converge over several frames: keep pumping while
            // refine/coarsen work is still queued, even on a static camera.
            if (!dirty && !this._engine.hasPendingWork) return;
        }
        this._forceNext = false;
        this._lastTransform.set(m);
        this._lastViewportHeight = viewportHeight;

        this._engine.setContext(this._viewId, this._provider.update(), this._clipBounds);
    }

    public dispose(): void {
        if (this._observer) {
            this._scene.onBeforeRenderObservable.remove(this._observer);
            this._observer = null;
        }
        this._provider.dispose();
    }
}
