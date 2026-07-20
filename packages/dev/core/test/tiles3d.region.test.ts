import { Ellipsoid } from "../src/geodesy";
import { BoxType } from "../src/tiles/3d/interfaces";
import { GeodeticRadToEcef, RegionToBoxECEF, RegionToSphereECEF } from "../src/tiles/3d/interfaces/math/region";

const DEG = Math.PI / 180;

/**
 * Exact OBB containment: |dot(p - c, axis)| <= |axis|^2 for each half axis
 * (axis vectors encode direction AND half-length).
 */
function boxContains(box: BoxType, p: { x: number; y: number; z: number }, tolerance = 1e-6): boolean {
    const dx = p.x - box[0];
    const dy = p.y - box[1];
    const dz = p.z - box[2];
    for (let a = 0; a < 3; a++) {
        const ax = box[3 + a * 3];
        const ay = box[4 + a * 3];
        const az = box[5 + a * 3];
        const len2 = ax * ax + ay * ay + az * az;
        const proj = Math.abs(dx * ax + dy * ay + dz * az);
        if (proj > len2 + tolerance * Math.max(len2, 1)) return false;
    }
    return true;
}

function samplePoints(west: number, south: number, east: number, north: number, hMin: number, hMax: number, steps: number) {
    const points = [];
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps; j++) {
            for (const h of [hMin, hMax]) {
                const lat = south + ((north - south) * i) / steps;
                const lon = west + ((east - west) * j) / steps;
                GeodeticRadToEcef(lat, lon, h, Ellipsoid.WGS84, p);
                points.push({ ...p });
            }
        }
    }
    return points;
}

describe("RegionToBoxECEF", () => {
    it("encloses a small (city-scale) region at every sampled surface point", () => {
        const west = -122.52 * DEG,
            south = 37.7 * DEG,
            east = -122.35 * DEG,
            north = 37.84 * DEG;
        const box = RegionToBoxECEF([west, south, east, north, -10, 500]);
        for (const p of samplePoints(west, south, east, north, -10, 500, 20)) {
            expect(boxContains(box, p)).toBe(true);
        }
    });

    it("stays tight for small regions (no kilometric over-inflation)", () => {
        const west = -122.42 * DEG,
            south = 37.77 * DEG,
            east = -122.41 * DEG,
            north = 37.78 * DEG;
        const box = RegionToBoxECEF([west, south, east, north, 0, 100]);
        const halfLengths = [Math.hypot(box[3], box[4], box[5]), Math.hypot(box[6], box[7], box[8]), Math.hypot(box[9], box[10], box[11])];
        // ~0.01 deg is ~1.1 km; the box must stay in that order of magnitude.
        for (const h of halfLengths) {
            expect(h).toBeLessThan(5_000);
        }
    });

    it("handles a continent-scale region", () => {
        const west = -30 * DEG,
            south = 20 * DEG,
            east = 50 * DEG,
            north = 70 * DEG;
        const box = RegionToBoxECEF([west, south, east, north, 0, 4000]);
        for (const p of samplePoints(west, south, east, north, 0, 4000, 25)) {
            expect(boxContains(box, p)).toBe(true);
        }
    });

    it("handles antimeridian-crossing regions (west > east)", () => {
        const west = 170 * DEG,
            south = -10 * DEG,
            east = -170 * DEG,
            north = 10 * DEG;
        const box = RegionToBoxECEF([west, south, east, north, 0, 100]);
        // sample using the unwrapped range
        for (const p of samplePoints(170 * DEG, -10 * DEG, 190 * DEG, 10 * DEG, 0, 100, 20)) {
            expect(boxContains(box, p)).toBe(true);
        }
    });

    it("encloses the whole planet for a full region", () => {
        const box = RegionToBoxECEF([-Math.PI, -Math.PI / 2, Math.PI, Math.PI / 2, 0, 0]);
        const p = { x: 0, y: 0, z: 0 };
        for (const [lat, lon] of [
            [90, 0],
            [-90, 0],
            [0, 0],
            [0, 90],
            [0, 180],
            [0, -90],
            [45, 135],
        ]) {
            GeodeticRadToEcef(lat * DEG, lon * DEG, 0, Ellipsoid.WGS84, p);
            expect(boxContains(box, p)).toBe(true);
        }
    });

    it("produces a sphere enclosing the box corners", () => {
        const region: [number, number, number, number, number, number] = [-122.52 * DEG, 37.7 * DEG, -122.35 * DEG, 37.84 * DEG, 0, 1000];
        const box = RegionToBoxECEF(region);
        const sphere = RegionToSphereECEF(region);
        // every surface sample must be inside the sphere
        for (const p of samplePoints(region[0], region[1], region[2], region[3], region[4], region[5], 10)) {
            const d = Math.hypot(p.x - sphere[0], p.y - sphere[1], p.z - sphere[2]);
            expect(d).toBeLessThanOrEqual(sphere[3] + 1e-6);
        }
        expect(sphere[3]).toBeGreaterThan(0);
        expect(Number.isFinite(box[0])).toBe(true);
    });
});
