import { describe, expect, it } from "vitest";

import { MotionRefinementScale, apparentPixelsPerSecond } from "../src";

const OPTIONS = { maxScale: 4, restPixelsPerSecond: 100, fullPixelsPerSecond: 1100, releaseMilliseconds: 300 };

describe("MotionRefinementScale", () => {
    it("keeps the threshold at rest and raises it at once with the speed, up to its maximum", () => {
        const motion = new MotionRefinementScale(OPTIONS);

        expect(motion.update(0, 0)).toBe(false);
        expect(motion.scale).toBe(1);
        motion.update(100, 16);
        expect(motion.scale).toBe(1);
        motion.update(600, 32);
        expect(motion.scale).toBe(2.5);
        motion.update(5000, 48);
        expect(motion.scale).toBe(4);
    });

    it("drops only once the speed has stayed lower, and says so", () => {
        const motion = new MotionRefinementScale(OPTIONS);
        motion.update(5000, 0);

        expect(motion.update(0, 100)).toBe(false);
        expect(motion.scale).toBe(4);
        expect(motion.update(0, 399)).toBe(false);
        expect(motion.scale).toBe(4);
        expect(motion.update(0, 400)).toBe(true);
        expect(motion.scale).toBe(1);
        expect(motion.update(0, 800)).toBe(false);
    });

    it("waits again when the speed comes back before the release", () => {
        const motion = new MotionRefinementScale(OPTIONS);
        motion.update(5000, 0);
        motion.update(0, 100);
        motion.update(5000, 200);

        expect(motion.update(0, 450)).toBe(false);
        expect(motion.scale).toBe(4);
    });

    it("rejects options without a range of speeds, or lowering the threshold", () => {
        expect(() => new MotionRefinementScale({ ...OPTIONS, maxScale: 0.5 })).toThrow(RangeError);
        expect(() => new MotionRefinementScale({ ...OPTIONS, fullPixelsPerSecond: 100 })).toThrow(RangeError);
    });
});

describe("apparentPixelsPerSecond", () => {
    const pose = (x: number, directionX = 0, upX = 0) => ({
        position: { x, y: 0, z: 0 },
        direction: { x: directionX, y: 0, z: 1 },
        up: { x: upX, y: 1, z: 0 },
    });

    it("is zero for a still camera, or without elapsed time", () => {
        expect(apparentPixelsPerSecond(pose(5), pose(5), 100, 1000, 0.016)).toBe(0);
        expect(apparentPixelsPerSecond(pose(5), pose(9), 100, 1000, 0)).toBe(0);
    });

    it("sees a turn about the axis of the view, where its direction does not change, as looking straight down", () => {
        expect(apparentPixelsPerSecond(pose(0, 0, 0), pose(0, 0, 0.1), 100, 1000, 1)).toBeCloseTo(100);
    });

    it("sees a move through the distance, and a turn whatever the distance", () => {
        expect(apparentPixelsPerSecond(pose(0), pose(10), 100, 1000, 1)).toBeCloseTo(100);
        expect(apparentPixelsPerSecond(pose(0), pose(10), 1000, 1000, 1)).toBeCloseTo(10);
        expect(apparentPixelsPerSecond(pose(0, 0), pose(0, 0.1), 100, 1000, 1)).toBeCloseTo(100);
        expect(apparentPixelsPerSecond(pose(0, 0), pose(0, 0.1), 1000, 1000, 1)).toBeCloseTo(100);
    });
});
