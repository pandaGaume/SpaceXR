import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { CameraChangeFlags } from "@spacexr/3d-tiles-runtime";

/** Detects camera pose and viewport changes between rendered frames. */
export class BabylonCameraChangeTracker {
    private readonly lastTransform = new Float64Array(16).fill(Number.NaN);
    private lastViewportHeight = Number.NaN;

    public constructor(
        private readonly camera: Camera,
        private readonly engine: AbstractEngine,
    ) {}

    /** Returns the changes since the previous capture and records the current state. */
    public capture(): CameraChangeFlags {
        const transform = this.camera.getTransformationMatrix().m;
        const viewportHeight = this.engine.getRenderHeight() * this.camera.viewport.height;
        let changes = CameraChangeFlags.None;
        if (viewportHeight !== this.lastViewportHeight) changes |= CameraChangeFlags.Viewport | CameraChangeFlags.Frustum;
        for (let index = 0; index < 16; index++) {
            if (transform[index] !== this.lastTransform[index]) {
                changes |= CameraChangeFlags.Pose | CameraChangeFlags.Frustum;
                break;
            }
        }
        if (changes !== CameraChangeFlags.None) {
            this.lastTransform.set(transform);
            this.lastViewportHeight = viewportHeight;
        }
        return changes;
    }

    /** Forgets the recorded state, so that the next capture reports every change. */
    public reset(): void {
        this.lastTransform.fill(Number.NaN);
        this.lastViewportHeight = Number.NaN;
    }
}
