import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { VerticalScale } from "@spacexr/3d-tiles-runtime";
import { ReferenceSurface, planetocentricDirection } from "@spacexr/tiles";
import { afterEach, describe, expect, it } from "vitest";

import { OrbitalCamera } from "../src/camera/orbital-camera";

const MOON = ReferenceSurface.sphere(1737400);

describe("OrbitalCamera", () => {
    const engine = new NullEngine();
    let scene: Scene | undefined;

    afterEach(() => scene?.dispose());

    function camera(options: Partial<ConstructorParameters<typeof OrbitalCamera>[1]> = {}): OrbitalCamera {
        scene = new Scene(engine);
        scene.useRightHandedSystem = true;
        return new OrbitalCamera(scene, {
            surface: MOON,
            direction: planetocentricDirection(-90, 0),
            radius: 5000,
            attachControl: false,
            ...options,
        });
    }

    it("centres on a pole, with a valid view", () => {
        const orbital = camera({ pitchRadians: 0.5 });
        expect(Math.hypot(orbital.position.x, orbital.position.y, orbital.position.z)).toBeGreaterThan(1737400);
        expect(Array.from(orbital.getViewMatrix().m).every(Number.isFinite)).toBe(true);
        expect(orbital.getClassName()).toBe("OrbitalCamera");
    });

    it("recomputes its view when its pose changes", () => {
        const orbital = camera();
        const before = Array.from(orbital.getViewMatrix().m);
        orbital.frame.pan(0.01, 0);
        orbital.poseChanged();
        scene!.onBeforeRenderObservable.notifyObservers(scene!);
        expect(Array.from(orbital.getViewMatrix().m)).not.toEqual(before);
    });

    it("starts on the terrain and stays above it", () => {
        const orbital = camera({
            direction: planetocentricDirection(10, 20),
            radius: 100,
            heightAt: () => 3000,
            altitudeMin: 50,
            radiusMin: 10,
        });
        expect(orbital.frame.centerHeight).toBe(3000);
        const distance = Math.hypot(orbital.position.x, orbital.position.y, orbital.position.z);
        expect(distance).toBeGreaterThanOrEqual(1737400 + 3000 + 50 - 1e-6);

        // Tilted almost flat, close to a slope higher than the point: the eye is lifted above the terrain.
        const low = camera({
            direction: planetocentricDirection(10, 20),
            radius: 20,
            pitchRadians: 1.5,
            heightAt: () => 3000,
            altitudeMin: 50,
            radiusMin: 10,
        });
        expect(Math.hypot(low.position.x, low.position.y, low.position.z)).toBeCloseTo(1737400 + 3050, 3);
    });

    it("applies the vertical scale of the scene to the terrain, and follows its changes", () => {
        const verticalScale = new VerticalScale(2);
        const orbital = camera({ direction: planetocentricDirection(10, 20), heightAt: () => 1000, verticalScale });
        expect(orbital.frame.centerHeight).toBe(2000);

        verticalScale.set(5);
        for (let frame = 0; frame < 200; frame++) scene!.onBeforeRenderObservable.notifyObservers(scene!);
        expect(orbital.frame.centerHeight).toBeCloseTo(5000, 0);

        orbital.dispose();
        verticalScale.set(1);
        expect(orbital.frame.centerHeight).toBeCloseTo(5000, 0);
    });

    it("ignores an unknown terrain height", () => {
        const orbital = camera({ direction: planetocentricDirection(10, 20), heightAt: () => Number.NaN, centerHeight: 7 });
        expect(orbital.frame.centerHeight).toBe(7);
        scene!.onBeforeRenderObservable.notifyObservers(scene!);
        expect(orbital.frame.centerHeight).toBe(7);
    });

    it("adapts its clipping planes to the altitude", () => {
        const near = camera({ radius: 1000 });
        const far = camera({ radius: 1000000 });
        expect(near.minZ).toBeLessThan(far.minZ);
        expect(near.maxZ).toBeLessThan(far.maxZ);
        expect(far.maxZ).toBeGreaterThan(far.frame.radius);
    });

    it("detaches its controls when disposed", () => {
        const orbital = camera();
        orbital.dispose();
        expect(() => orbital.detachControl()).not.toThrow();
    });
});
