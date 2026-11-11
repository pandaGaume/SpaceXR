import { ReferenceSurface, planetocentricDirection, type ICartesian3 } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { OrbitFrame } from "../src/camera/orbit-frame";

const MOON = ReferenceSurface.sphere(1737400);
const MARS = new ReferenceSurface(3396190, 3396190, 3376200);
const dot = (a: ICartesian3, b: ICartesian3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const distance = (a: ICartesian3, b: ICartesian3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function expectValid(frame: OrbitFrame): void {
    expect(Math.hypot(frame.direction.x, frame.direction.y, frame.direction.z)).toBeCloseTo(1, 12);
    expect(Math.hypot(frame.forward.x, frame.forward.y, frame.forward.z)).toBeCloseTo(1, 12);
    expect(dot(frame.forward, frame.up)).toBeCloseTo(0, 10);
    expect(Math.hypot(frame.look.x, frame.look.y, frame.look.z)).toBeCloseTo(1, 12);
    expect(dot(frame.look, frame.viewUp)).toBeCloseTo(0, 10);
    expect(Number.isFinite(frame.position.x + frame.position.y + frame.position.z)).toBe(true);
}

describe("OrbitFrame", () => {
    it("looks straight down at pitch 0 and toward the forward direction when tilted", () => {
        const frame = new OrbitFrame({ surface: MOON, direction: planetocentricDirection(20, 40), radius: 1000 });
        expect(distance(frame.position, MOON.point(frame.direction, 1000))).toBeLessThan(1e-6);
        frame.pitch = Math.PI / 4;
        expect(dot(frame.look, frame.forward)).toBeCloseTo(Math.SQRT1_2, 12);
        expect(dot(frame.look, frame.up)).toBeCloseTo(-Math.SQRT1_2, 12);
        expect(distance(frame.position, frame.center)).toBeCloseTo(1000, 6);
    });

    it("starts toward the north, turned by the heading", () => {
        const north = new OrbitFrame({ surface: MOON, direction: planetocentricDirection(0, 0), radius: 1000 });
        expect(distance(north.forward, { x: 0, y: 0, z: 1 })).toBeLessThan(1e-12);
        expect(north.right.y).toBeCloseTo(1, 12);
        const east = new OrbitFrame({ surface: MOON, direction: planetocentricDirection(0, 0), radius: 1000, headingRadians: Math.PI / 2 });
        expect(distance(east.forward, { x: 0, y: 1, z: 0 })).toBeLessThan(1e-12);
        expect(east.headingRadians).toBeCloseTo(Math.PI / 2, 12);
    });

    it.each([90, -90])("is defined at the pole of latitude %i", (latitude) => {
        const frame = new OrbitFrame({ surface: MOON, direction: planetocentricDirection(latitude, 0), radius: 5000, pitchRadians: 0.5 });
        expectValid(frame);
        expect(frame.forward.x).toBeCloseTo(1, 9);
        expect(frame.headingRadians).toBeUndefined();
        frame.rotateHeading(1);
        expectValid(frame);
    });

    it("crosses a pole along a great circle, keeping its view continuous", () => {
        // Starts on the meridian 0, moving toward the south pole, and ends on the meridian 180.
        const frame = new OrbitFrame({
            surface: MOON,
            direction: planetocentricDirection(-88, 0),
            radius: 5000,
            pitchRadians: 0.6,
            headingRadians: Math.PI,
        });
        const steps = 400;
        const step = (4 * Math.PI) / 180 / steps;
        let previousLook = frame.look;
        let previousPosition = frame.position;
        let closest = 1;
        for (let index = 0; index < steps; index++) {
            frame.pan(0, step);
            expectValid(frame);
            // The view turns by no more than the step: the pole is not a singularity.
            expect(distance(frame.look, previousLook)).toBeLessThan(step * 1.01);
            expect(distance(frame.position, previousPosition)).toBeLessThan((1737400 + 5000) * step * 1.01);
            previousLook = frame.look;
            previousPosition = frame.position;
            closest = Math.min(closest, Math.hypot(frame.direction.x, frame.direction.y));
        }
        expect(closest).toBeLessThan(step);
        const end = planetocentricDirection(-88, 180);
        expect(distance(frame.direction, end)).toBeLessThan(1e-9);
    });

    it("comes back along the opposite pan", () => {
        const frame = new OrbitFrame({ surface: MOON, direction: planetocentricDirection(-89.7, 130), radius: 5000 });
        const start = { ...frame.direction };
        const forward = { ...frame.forward };
        frame.pan(0.02, -0.01);
        frame.pan(-0.02, 0.01);
        expect(distance(frame.direction, start)).toBeLessThan(1e-12);
        expect(distance(frame.forward, forward)).toBeLessThan(1e-12);
    });

    it("moves toward its right and its forward direction", () => {
        const frame = new OrbitFrame({ surface: MOON, direction: planetocentricDirection(0, 0), radius: 1000 });
        frame.pan(0.1, 0);
        expect(frame.direction.y).toBeCloseTo(Math.sin(0.1), 12);
        const other = new OrbitFrame({ surface: MOON, direction: planetocentricDirection(0, 0), radius: 1000 });
        other.pan(0, 0.1);
        expect(other.direction.z).toBeCloseTo(Math.sin(0.1), 12);
        other.pan(0, 0);
        expect(other.direction.z).toBeCloseTo(Math.sin(0.1), 12);
    });

    it("keeps its tangent in the tangent plane on a flattened body, up to the pole", () => {
        const frame = new OrbitFrame({ surface: MARS, direction: planetocentricDirection(45, 10), radius: 2000, headingRadians: 0.3 });
        for (let index = 0; index < 200; index++) {
            frame.pan(0.001, 0.01);
            expectValid(frame);
        }
        expect(distance(frame.center, MARS.point(frame.direction))).toBeLessThan(1e-6);
    });

    it("clamps its pitch and radius, and rejects invalid limits and directions", () => {
        const frame = new OrbitFrame({ surface: MOON, direction: { x: 2, y: 0, z: 0 }, radius: 5, radiusMin: 100, radiusMax: 1000 });
        expect(frame.radius).toBe(100);
        frame.radius = 5000;
        expect(frame.radius).toBe(1000);
        frame.pitch = 3;
        expect(frame.pitch).toBe(frame.pitchMax);
        frame.pitch = -1;
        expect(frame.pitch).toBe(0);
        expect(() => new OrbitFrame({ surface: MOON, direction: { x: 0, y: 0, z: 0 }, radius: 1 })).toThrow(RangeError);
        expect(() => new OrbitFrame({ surface: MOON, direction: { x: 1, y: 0, z: 0 }, radius: 1, radiusMin: 10, radiusMax: 5 })).toThrow(
            RangeError,
        );
    });
});
