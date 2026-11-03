import test from 'node:test';
import assert from 'node:assert/strict';
import { WGS84, altitude, atmosphericInterval, geodeticPosition, intersectEllipsoid, normalize } from '../src/geometry.js';
import { Atmosphere } from '../src/model.js';
import { AtmosphereOctree } from '../src/octree.js';
import { integrate } from '../src/integrator.js';
const close = (a, b, epsilon) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b} (tolerance ${epsilon})`);

test('geodetic altitude at equator, poles, mid-latitudes and exaggerated flattening', () => {
    for (const e of [WGS84, { semiMajorAxis: 6378137, semiMinorAxis: 5000000 }]) {
        for (const lat of [-Math.PI / 2, -1, 0, 0.7, Math.PI / 2]) {
            for (const h of [1, 1000, 100000, 1000000]) close(altitude(e, geodeticPosition(e, lat, 0.4, h)), h, 0.01);
        }
    }
});
test('ray intersections retain meters and honor unequal polar and equatorial axes', () => {
    const e = WGS84;
    close(intersectEllipsoid(e, [e.semiMajorAxis + 1000, 0, 0], [-1, 0, 0])[0], 1000, 1e-6);
    close(intersectEllipsoid(e, [0, 0, e.semiMinorAxis + 2000], [0, 0, -1])[0], 2000, 1e-6);
    assert.equal(intersectEllipsoid(e, [e.semiMajorAxis + 1000, 0, 0], [0, 1, 0]), null);
});
test('atmosphere clips at ground, supports orbital views and finite terrain depth', () => {
    const m = new Atmosphere(), o = [WGS84.semiMajorAxis + 1000, 0, 0];
    close(atmosphericInterval(m, o, [-1, 0, 0]).end, 1000, 1e-6);
    close(atmosphericInterval(m, o, [-1, 0, 0], 100).end, 100, 1e-6);
    assert.equal(atmosphericInterval(m, [WGS84.semiMajorAxis, 0, 0], [-1, 0, 0]), null);
    assert.ok(atmosphericInterval(m, [WGS84.semiMajorAxis + 500000, 0, 0], [-1, 0, 0]).start > 0);
});
test('planet occludes sunlight and vacuum preserves radiance and transmission', () => {
    const m = new Atmosphere();
    assert.deepEqual(m.solarTransmittance([-WGS84.semiMajorAxis - 10000, 0, 0]), [0, 0, 0]);
    const vacuum = new Atmosphere({ rayleigh: [0, 0, 0], mieScattering: 0, mieExtinction: 0 });
    const r = integrate(vacuum, [WGS84.semiMajorAxis + 1000, 0, 0], [1, 0, 0]);
    assert.deepEqual(r.radiance, [0, 0, 0]); assert.deepEqual(r.transmittance, [1, 1, 1]);
});
test('tree keeps offscreen solar paths, reuses caches and respects its budget', () => {
    const m = new Atmosphere({ sun: [0.4, 1, 0], solarSteps: 64 });
    const tree = new AtmosphereOctree(m, { maxNodes: 5000, seamBlendFraction: 0 });
    const p = geodeticPosition(WGS84, 0.4, 0, 30000);
    const found = tree.locate(p, [[WGS84.semiMajorAxis + 1000, 0, 0]]);
    assert.ok(found.cacheable);
    const direct = m.solarTransmittance(p), cached = tree.solar(p, found);
    for (let c = 0; c < 3; c++) close(cached[c], direct[c], 0.015);
    const count = m.stats.solarIntegrations;
    tree.solar(p, found); assert.equal(m.stats.solarIntegrations, count); assert.ok(tree.stats.hits > 0);
    const limited = new AtmosphereOctree(m, { maxNodes: 1 });
    const coarse = limited.locate(p, [p]); assert.equal(coarse.cacheable, false); assert.equal(limited.nodes, 1);
    assert.deepEqual(limited.solar(p, coarse), direct);
});
test('accelerated rays agree with numerical reference for ground, horizon, orbit and night', () => {
    for (const scenario of [
        { o: [WGS84.semiMajorAxis + 2000, 0, 0], d: [1, 0.2, 0], sun: [1, 1, 0] },
        { o: [WGS84.semiMajorAxis + 2000, 0, 0], d: [0.01, 1, 0], sun: [0.02, 1, 0] },
        { o: [WGS84.semiMajorAxis + 400000, 0, 0], d: [-1, 0.1, 0], sun: [1, 1, 0] },
        { o: [-WGS84.semiMajorAxis - 2000, 0, 0], d: [-1, 0.1, 0], sun: [1, 0, 0] }
    ]) {
        const m = new Atmosphere({ sun: scenario.sun, solarSteps: 128 });
        const tree = new AtmosphereOctree(m);
        const reference = integrate(m, scenario.o, scenario.d, { maxStep: 500 });
        const result = integrate(m, scenario.o, scenario.d, { tree, maxStep: 500 });
        for (let c = 0; c < 3; c++) {
            close(result.radiance[c], reference.radiance[c], 0.002 + 0.04 * reference.radiance[c]);
            close(result.transmittance[c], reference.transmittance[c], 0.003);
            assert.ok(result.radiance[c] >= 0 && Number.isFinite(result.radiance[c]));
            assert.ok(result.transmittance[c] >= 0 && result.transmittance[c] <= 1);
        }
    }
});
test('invalid settings fail early', () => {
    assert.throws(() => new Atmosphere({ ellipsoid: { semiMajorAxis: 0, semiMinorAxis: 1 } }));
    assert.throws(() => new Atmosphere({ solarSteps: 0 }));
    assert.throws(() => new AtmosphereOctree(new Atmosphere(), { maxNodes: 0 }));
    assert.throws(() => integrate(new Atmosphere(), [1, 2, 3], [1, 0, 0], { maxStep: 0 }));
    assert.throws(() => normalize([0, 0, 0]));
});
import { packOctree } from '../src/gpu.js';

test('packed GPU octree has consistent indices, flags and kilometer coordinates', () => {
    const m = new Atmosphere(), tree = new AtmosphereOctree(m);
    const p = geodeticPosition(WGS84, 0.3, 0.2, 30000), leaf = tree.locate(p, [p]);
    tree.solar(p, leaf);
    const data = packOctree(tree), f = new Float32Array(data), u = new Uint32Array(data);
    assert.equal(data.byteLength, tree.nodes * 192);
    close(f[3], tree.root.half / 1000, 0.001);
    let lit = 0;
    for (let n = 0; n < tree.nodes; n++) {
        for (let c = 0; c < 8; c++) assert.ok(u[n * 48 + 4 + c] < tree.nodes);
        if (u[n * 48 + 12]) lit++;
    }
    assert.ok(lit > 0);
});
test('moving views and stereo eyes reuse a bounded tree with physical fallback', () => {
    const m = new Atmosphere(), tree = new AtmosphereOctree(m, { maxNodes: 80 });
    const eye = geodeticPosition(WGS84, 0.4, 0.2, 1000);
    for (const offset of [0, 1000, 100000]) {
        const origin = [eye[0], eye[1] + offset, eye[2]];
        const result = integrate(m, origin, [1, 0.2, 0.3], { tree, eyes: [origin, [origin[0], origin[1] + 0.064, origin[2]]], maxStep: 5000 });
        assert.ok(result.radiance.every(Number.isFinite));
    }
    assert.ok(tree.nodes <= 80);
    assert.ok(tree.stats.direct > 0);
});
test('empty cells are conservative above the shell and inside the ground', () => {
    const m = new Atmosphere(), tree = new AtmosphereOctree(m);
    const r = tree.root.half;
    assert.equal(tree.bounds({ center: [r, r, r], half: 100 }).low > m.top, true);
    assert.equal(tree.bounds({ center: [0, 0, 0], half: 100 }).ground, true);
});
test('immutable atmosphere prevents stale caches and accepts SpaceXR axis-shaped objects', () => {
    const e = { get semiMajorAxis() { return WGS84.semiMajorAxis; }, get semiMinorAxis() { return WGS84.semiMinorAxis; } };
    const m = new Atmosphere({ ellipsoid: e });
    assert.throws(() => { m.sun = [0, 1, 0]; });
    assert.throws(() => { m.sun[0] = 0; });
    assert.deepEqual(m.ellipsoid, WGS84);
});
test('numerical reference is stable when integration resolution is doubled', () => {
    const o = geodeticPosition(WGS84, 0.4, 0.3, 2000), direction = normalize([0.1, 1, 0]);
    const coarse = integrate(new Atmosphere({ solarSteps: 128 }), o, direction, { maxStep: 1000 });
    const fine = integrate(new Atmosphere({ solarSteps: 256 }), o, direction, { maxStep: 500 });
    for (let c = 0; c < 3; c++) close(coarse.radiance[c], fine.radiance[c], 0.0005);
});
import { buildSolarGrid, sampleSolarGrid, toFloat16 } from '../src/grid.js';

test('common lattice keeps finite transmittance and falls back at shell boundaries', () => {
    const m = new Atmosphere({ solarSteps: 32 }), o = geodeticPosition(WGS84, 0, 0, 20000);
    const rays = [[1, 0.1, 0.1], [1, -0.1, -0.1], [0.5, 0.2, -0.2], [0.5, -0.2, 0.2]].map(normalize);
    const grid = buildSolarGrid(m, o, rays, 8);
    assert.equal(grid.data.length, 8 ** 3 * 4);
    assert.ok(grid.flags.some(v => v === 1));
    assert.equal(sampleSolarGrid(grid, [0, 0, 0]), null);
    let checked = 0;
    for (let z = 0; z < 7; z++) for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const p = [x + 0.5, y + 0.5, z + 0.5].map((v, c) => grid.min[c] + v * grid.step[c]);
        const cached = sampleSolarGrid(grid, p);
        if (!cached) continue;
        const direct = m.solarTransmittance(p);
        for (let c = 0; c < 3; c++) { assert.ok(cached[c] >= 0 && cached[c] <= 1); close(cached[c], direct[c], 0.04); }
        checked++;
    }
    assert.ok(checked > 0);
});
test('float16 packing rounds transmittance correctly, including subnormals', () => {
    assert.deepEqual(Array.from(toFloat16(new Float32Array([0, 1, 0.5, -0, 2 ** -24, 2 ** -14]))), [0, 0x3c00, 0x3800, 0x8000, 1, 0x0400]);
});
import { measureContinuity } from '../continuity.js';
test('solar cache remains continuous at same-level and mixed-level cell faces', () => {
    const result = measureContinuity(0.08);
    assert.ok(result.transitions > 0); assert.ok(result.mixedTransitions > 0);
    assert.ok(result.sameLevelMax < 1e-6, JSON.stringify(result));
    assert.ok(result.mixedLevelMax < 1e-6, JSON.stringify(result));
});

