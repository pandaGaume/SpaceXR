import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import { Axis } from "@babylonjs/core/Maths/math.axis.js";
import type { Observer } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { CameraChangeFlags, type IEcefCameraFrame } from "@spacexr/3d-tiles-runtime";

import { BabylonCameraChangeTracker } from "../camera/camera-change-tracker";
import { createEcefCameraFrame, type IEcefCameraFrameOptions } from "../spatial/camera-frame";
import { apparentPixelsPerSecond, type ICameraPose, type MotionRefinementScale } from "./motion-refinement";

/** Part of `TileRuntime` driven frame by frame. */
export interface IFrameDrivenRuntime {
    readonly hasPendingWork: boolean;
    start(): Promise<void>;
    onCameraChanged(camera: IEcefCameraFrame, changes?: CameraChangeFlags): void;
    processFrame(): Promise<unknown>;
    /** Asks for one more frame with the latest camera. */
    requestFrame?(): void;
}

/** Follows the speed of the camera for the threshold of new refinements of a runtime. */
export interface IBabylonRuntimeMotion {
    /** The factor the runtime reads, in `refinementThresholdScale`. */
    scale: MotionRefinementScale;
    /** Distance from the camera to the terrain it looks at, which turns its move into an apparent speed. */
    surfaceDistance: () => number;
}

export interface IBabylonRuntimeDriverOptions {
    /** Camera submitted to the runtime. Defaults to the active camera of the scene when the driver starts. */
    camera?: Camera;
    /** The owner awaits updateBeforeRender instead of following onAfterRender. */
    manual?: boolean;
    /** Receives failures of frames processed after start. Defaults to `console.error`. */
    onError?: (error: unknown) => void;
    /** Periphery of the view, where tiles stay active; see {@link IEcefCameraFrameOptions.frustumMargin}. Defaults to 0. */
    frustumMargin?: number;
    /** Holds back new refinements while the camera moves fast. Without it, the threshold of the runtime is fixed. */
    motion?: IBabylonRuntimeMotion;
}

/**
 * Drives a 3D Tiles runtime from the Babylon render loop.
 *
 * After each rendered frame, the driver submits camera changes and runs at most one runtime frame at a time, only
 * when the camera moved or when settled loads require a refresh. A still camera therefore costs no traversal.
 */
export class BabylonRuntimeDriver {
    private camera: Camera | undefined;
    private tracker: BabylonCameraChangeTracker | undefined;
    private observer: Observer<Scene> | null = null;
    private frameOperation: Promise<void> | undefined;
    private readonly manual: boolean;
    private disposed = false;
    private readonly onError: (error: unknown) => void;
    private readonly frameOptions: IEcefCameraFrameOptions;
    private readonly motion: IBabylonRuntimeMotion | undefined;
    private lastPose: (ICameraPose & { milliseconds: number }) | undefined;

    public constructor(
        private readonly runtime: IFrameDrivenRuntime,
        private readonly scene: Scene,
        options: IBabylonRuntimeDriverOptions = {},
    ) {
        this.camera = options.camera;
        this.manual = options.manual ?? false;
        this.motion = options.motion;
        this.frameOptions = options.frustumMargin === undefined ? {} : { frustumMargin: options.frustumMargin };
        this.onError = options.onError ?? ((error) => console.error("3D Tiles runtime frame failed", error));
    }

    /**
     * Starts the runtime, processes the first frame for the current camera and then follows the render loop. The
     * returned promise rejects when the runtime cannot start.
     */
    public async start(): Promise<void> {
        if (this.disposed) throw new Error("The runtime driver has been disposed.");
        if (this.tracker) return;
        const camera = this.camera ?? this.scene.activeCamera;
        if (!camera) throw new Error("The scene has no active camera to drive the runtime.");
        this.camera = camera;
        this.tracker = new BabylonCameraChangeTracker(camera, this.scene.getEngine());

        await this.runtime.start();
        // Babylon computes camera matrices while rendering; before the first frame they must be forced.
        camera.getViewMatrix(true);
        camera.getProjectionMatrix(true);
        this.tracker.capture();
        this.runtime.onCameraChanged(this.cameraFrame(), CameraChangeFlags.All);
        await this.runtime.processFrame();
        if (this.disposed) return;
        if (!this.manual) this.observer = this.scene.onAfterRenderObservable.add(() => this.update());
    }

    /** Submits camera changes and starts a runtime frame when work is pending. Called after each rendered frame. */
    public update(): void {
        if (!this.tracker || this.disposed) return;
        this.submitCamera();
        if (this.frameOperation || !this.runtime.hasPendingWork) return;
        void this.runFrame().catch((error: unknown) => {
            if (!this.disposed) this.onError(error);
        });
    }

    /**
     * Publishes the ready selection for the current camera before its scene is drawn. The owner updates the camera
     * first, awaits this method, and then calls scene.render(false), so its input is not applied twice.
     */
    public async updateBeforeRender(): Promise<void> {
        if (!this.tracker || this.disposed) return;
        this.submitCamera();
        if (this.frameOperation) await this.frameOperation;
        if (!this.disposed && this.runtime.hasPendingWork) await this.runFrame();
    }

    private submitCamera(): void {
        const camera = this.camera!;
        camera.getViewMatrix(true);
        camera.getProjectionMatrix(true);
        const changes = this.tracker!.capture();
        if (changes !== CameraChangeFlags.None) this.runtime.onCameraChanged(this.cameraFrame(), changes);
        this.followMotion();
    }

    private runFrame(): Promise<void> {
        if (this.frameOperation) return this.frameOperation;
        this.frameOperation = this.runtime
            .processFrame()
            .then(() => undefined)
            .finally(() => {
                this.frameOperation = undefined;
            });
        return this.frameOperation;
    }

    /** Stops following the render loop. The runtime itself is disposed by its owner. */
    public dispose(): void {
        this.disposed = true;
        this.scene.onAfterRenderObservable.remove(this.observer);
        this.observer = null;
    }

    /** A still camera asks for no frame: when the factor drops, the view needs one to refine. */
    private followMotion(): void {
        if (!this.motion) return;
        const camera = this.camera!;
        const milliseconds = performance.now();
        const position = camera.globalPosition;
        const direction = camera.getDirection(Axis.Z);
        const pose = {
            position: { x: position.x, y: position.y, z: position.z },
            direction,
            up: camera.getDirection(Axis.Y),
            milliseconds,
        };
        const previous = this.lastPose;
        this.lastPose = pose;
        if (!previous) return;
        const focalPixels = this.scene.getEngine().getRenderHeight() / (2 * Math.tan(camera.fov / 2));
        const speed = apparentPixelsPerSecond(
            previous,
            pose,
            this.motion.surfaceDistance(),
            focalPixels,
            (milliseconds - previous.milliseconds) / 1000,
        );
        if (this.motion.scale.update(speed, milliseconds)) this.runtime.requestFrame?.();
    }

    private cameraFrame(): IEcefCameraFrame {
        return createEcefCameraFrame(this.camera!, this.scene.getEngine(), this.frameOptions);
    }
}
