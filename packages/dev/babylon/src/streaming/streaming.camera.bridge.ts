import { Camera, Quaternion, Scene } from "@babylonjs/core";
import { ICameraViewState } from "core/camera";
import { IBounds, ICartesian3, IPlane, IQuaternion } from "core/geometry";

/**
 * Thin bridge from a Babylon.js `Camera` to the engine-agnostic `ICameraViewState`
 * consumed by the streaming pipeline.
 *
 * The bridge holds mutable fields that are refreshed on every `update()` call,
 * so instances can be reused frame after frame without allocating new state
 * objects. The host drives the cadence explicitly (typically from
 * `scene.onBeforeRenderObservable`):
 *
 *     bridge.update();
 *     engine.setContext("main", bridge);
 *
 * `isInFrustum(bounds)` piggy-backs on the scene's cached frustum planes; when
 * they are not available yet the method is permissive (returns true) and lets
 * the rest of the SSE / near-far cull do the work.
 */
export class BabylonCameraBridge implements ICameraViewState {
    public readonly worldPosition: ICartesian3 = { x: 0, y: 0, z: 0 };
    public readonly worldRotation: IQuaternion = { x: 0, y: 0, z: 0, w: 1 };

    public fovY = 0;
    public tanFov2 = 0;
    public near?: number;
    public far?: number;
    public aspect?: number;
    public viewportHeight?: number;
    public readonly up: ICartesian3 = { x: 0, y: 1, z: 0 };
    public readonly frustumPlanes: Array<IPlane> = [];

    private readonly _tempQuat = Quaternion.Identity();

    public constructor(public readonly camera: Camera, public readonly scene?: Scene) {
        this.update();
    }

    /** Refresh every field from the current state of the Babylon camera + scene. */
    public update(): void {
        const cam = this.camera;
        const scene = this.scene ?? cam.getScene();

        // Position (globalPosition accounts for parent transforms)
        const pos = cam.globalPosition;
        this.worldPosition.x = pos.x;
        this.worldPosition.y = pos.y;
        this.worldPosition.z = pos.z;

        // Rotation: decompose from the camera's world matrix, robust across all
        // babylon camera subclasses (ArcRotate, Free, Geodetic, …) regardless of
        // whether they expose a `rotationQuaternion` directly.
        cam.getWorldMatrix().decompose(undefined, this._tempQuat, undefined);
        this.worldRotation.x = this._tempQuat.x;
        this.worldRotation.y = this._tempQuat.y;
        this.worldRotation.z = this._tempQuat.z;
        this.worldRotation.w = this._tempQuat.w;

        // Optics
        this.fovY = cam.fov;
        this.tanFov2 = Math.tan(this.fovY * 0.5);
        this.near = cam.minZ;
        this.far = cam.maxZ;

        // Up vector
        if (cam.upVector) {
            this.up.x = cam.upVector.x;
            this.up.y = cam.upVector.y;
            this.up.z = cam.upVector.z;
        }

        // Viewport (pixels) + aspect ratio
        const engine = scene?.getEngine();
        if (engine) {
            this.viewportHeight = engine.getRenderHeight();
            const w = engine.getRenderWidth();
            this.aspect = this.viewportHeight > 0 ? w / this.viewportHeight : undefined;
        }

        // Frustum planes: sync the array in place.
        const planes = scene?.frustumPlanes;
        if (planes && planes.length > 0) {
            while (this.frustumPlanes.length < planes.length) {
                this.frustumPlanes.push({ normal: { x: 0, y: 0, z: 0 }, d: 0 });
            }
            while (this.frustumPlanes.length > planes.length) this.frustumPlanes.pop();
            for (let i = 0; i < planes.length; i++) {
                const p = planes[i];
                const ip = this.frustumPlanes[i];
                ip.normal.x = p.normal.x;
                ip.normal.y = p.normal.y;
                ip.normal.z = p.normal.z;
                ip.d = p.d;
            }
        } else if (this.frustumPlanes.length > 0) {
            this.frustumPlanes.length = 0;
        }
    }

    /**
     * Frustum culling using the scene's cached planes (half-space test against
     * the bounds' circumscribed sphere). Permissive when planes are unavailable.
     */
    public isInFrustum(bounds: IBounds): boolean {
        const planes = this.frustumPlanes;
        if (!planes || planes.length === 0) return true;
        const cx = bounds.center.x;
        const cy = bounds.center.y;
        const cz = bounds.center.z;
        const r = Math.max(bounds.extendSize.x, bounds.extendSize.y, bounds.extendSize.z);
        for (const p of planes) {
            const d = p.normal.x * cx + p.normal.y * cy + p.normal.z * cz + p.d;
            if (d < -r) return false;
        }
        return true;
    }
}
