import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { CameraChangeFlags, type IEcefCameraFrame } from "@spacexr/3d-tiles-runtime";
import { describe, expect, it, vi } from "vitest";

import { BabylonCameraChangeTracker, BabylonRuntimeDriver, MotionRefinementScale, type IFrameDrivenRuntime } from "../src";
import { createNullScene } from "./helpers";

class FakeRuntime implements IFrameDrivenRuntime {
    public hasPendingWork = false;
    public readonly cameras: Array<{ camera: IEcefCameraFrame; changes: CameraChangeFlags | undefined }> = [];
    public frames = 0;
    public readonly start = vi.fn(async () => undefined);

    public onCameraChanged(camera: IEcefCameraFrame, changes?: CameraChangeFlags): void {
        this.cameras.push({ camera, changes });
        this.hasPendingWork = true;
    }

    public async processFrame(): Promise<unknown> {
        this.frames++;
        this.hasPendingWork = false;
        return undefined;
    }
}

function createCameraScene() {
    const scene = createNullScene();
    const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene);
    camera.setTarget(Vector3.Zero());
    return { scene, camera };
}

describe("BabylonRuntimeDriver with motion", () => {
    it("asks for a frame once the factor drops, although the camera is still", async () => {
        const { scene, camera } = createCameraScene();
        const runtime = new FakeRuntime();
        const requestFrame = vi.fn();
        const scale = new MotionRefinementScale({ maxScale: 4, restPixelsPerSecond: 1, fullPixelsPerSecond: 2, releaseMilliseconds: 0 });
        const driver = new BabylonRuntimeDriver(Object.assign(runtime, { requestFrame }), scene, {
            camera,
            motion: { scale, surfaceDistance: () => 1 },
        });
        await driver.start();
        const now = vi.spyOn(performance, "now");

        now.mockReturnValue(1000);
        driver.update();
        now.mockReturnValue(1016);
        camera.position.x += 5;
        camera.computeWorldMatrix();
        driver.update();
        expect(scale.scale).toBe(4);
        expect(requestFrame).not.toHaveBeenCalled();

        now.mockReturnValue(1032);
        driver.update();
        expect(scale.scale).toBe(1);
        expect(requestFrame).toHaveBeenCalledTimes(1);
        now.mockRestore();
    });
});

describe("BabylonCameraChangeTracker", () => {
    it("reports pose changes once and stays silent while the camera is still", () => {
        const { scene, camera } = createCameraScene();
        const tracker = new BabylonCameraChangeTracker(camera, scene.getEngine());

        scene.render();
        expect(tracker.capture()).toBe(CameraChangeFlags.Pose | CameraChangeFlags.Projection);
        expect(tracker.capture()).toBe(CameraChangeFlags.None);

        camera.position.x += 5;
        scene.render();
        expect(tracker.capture() & CameraChangeFlags.Pose).toBe(CameraChangeFlags.Pose);
        expect(tracker.capture()).toBe(CameraChangeFlags.None);

        tracker.reset();
        expect(tracker.capture()).not.toBe(CameraChangeFlags.None);
    });
});

describe("BabylonRuntimeDriver", () => {
    it("processes the first frame on start, then only when the camera moves", async () => {
        const { scene, camera } = createCameraScene();
        const runtime = new FakeRuntime();
        const driver = new BabylonRuntimeDriver(runtime, scene);

        await driver.start();
        expect(runtime.start).toHaveBeenCalledOnce();
        expect(runtime.cameras).toHaveLength(1);
        expect(runtime.cameras[0]!.changes).toBe(CameraChangeFlags.All);
        expect(runtime.cameras[0]!.camera.id).toBe(camera.id);
        expect(runtime.cameras[0]!.camera.frustumPlanes).toHaveLength(6);
        expect(runtime.frames).toBe(1);

        scene.render();
        await Promise.resolve();
        expect(runtime.frames).toBe(1);

        camera.position.y += 3;
        scene.render();
        await Promise.resolve();
        expect(runtime.cameras).toHaveLength(2);
        expect(runtime.frames).toBe(2);

        driver.dispose();
        camera.position.y += 3;
        scene.render();
        expect(runtime.cameras).toHaveLength(2);
    });

    it("reports failed frames without stopping", async () => {
        const { scene, camera } = createCameraScene();
        const runtime = new FakeRuntime();
        const onError = vi.fn();
        const driver = new BabylonRuntimeDriver(runtime, scene, { camera, onError });
        await driver.start();

        runtime.processFrame = () => Promise.reject(new Error("frame failed"));
        runtime.hasPendingWork = true;
        driver.update();
        await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
        driver.dispose();
    });

    it("requires a camera", async () => {
        const scene = createNullScene();
        await expect(new BabylonRuntimeDriver(new FakeRuntime(), scene).start()).rejects.toThrow("no active camera");
    });
});

describe("BabylonRuntimeDriver before rendering", () => {
    it("publishes the current camera selection manually and does no traversal while still", async () => {
        const { scene, camera } = createCameraScene();
        const runtime = new FakeRuntime();
        const driver = new BabylonRuntimeDriver(runtime, scene, { camera, manual: true });
        await driver.start();
        camera.position.x = 25;
        camera.update();
        scene.render(false);
        expect(runtime.frames).toBe(1);
        await driver.updateBeforeRender();
        expect(runtime.frames).toBe(2);
        expect(runtime.cameras.at(-1)?.camera.position.x).toBe(25);
        scene.render(false);
        await driver.updateBeforeRender();
        expect(runtime.frames).toBe(2);
        driver.dispose();
        scene.dispose();
    });

    it("waits for publication and shares an in-progress frame", async () => {
        const { scene, camera } = createCameraScene();
        const runtime = new FakeRuntime();
        const driver = new BabylonRuntimeDriver(runtime, scene, { camera, manual: true });
        await driver.start();
        let publish: (() => void) | undefined;
        const process = vi.fn(() => {
            runtime.hasPendingWork = false;
            return new Promise<void>((resolve) => {
                publish = resolve;
            });
        });
        runtime.processFrame = process;
        runtime.hasPendingWork = true;
        let published = false;
        const first = driver.updateBeforeRender().then(() => {
            published = true;
        });
        const second = driver.updateBeforeRender();
        await Promise.resolve();
        expect(process).toHaveBeenCalledTimes(1);
        expect(published).toBe(false);
        publish!();
        await Promise.all([first, second]);
        expect(published).toBe(true);
        expect(process).toHaveBeenCalledTimes(1);
        driver.dispose();
        scene.dispose();
    });
});
