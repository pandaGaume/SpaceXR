import test from 'node:test';
import assert from 'node:assert/strict';
import { WGS84, geodeticPosition, normalize } from '../src/geometry.js';
import { Atmosphere } from '../src/model.js';
import { AtmosphereOctree } from '../src/octree.js';
import { integrate, integrateProfile } from '../src/integrator.js';
import { FrustumCamera, FrustumVolume } from '../src/frustum.js';
const origin = geodeticPosition(WGS84, 0.4, 0.2, 20000);
const camera = () => new FrustumCamera(origin, normalize(origin), normalize([-origin[1], origin[0], 0]), normalize([-origin[0] * origin[2], -origin[1] * origin[2], origin[0] ** 2 + origin[1] ** 2]), 0.25, 0.15);
const close = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test('cumulative checkpoints match independent integrations and preserve near-camera identity', () => {
    const model = new Atmosphere({ solarSteps: 32 }), ray = normalize(origin), distances = [0, 1000, 5000, 20000, 100000];
    const profile = integrateProfile(model, origin, ray, distances, { maxStep: 500 });
    assert.deepEqual(profile[0].radiance, [0, 0, 0]); assert.deepEqual(profile[0].transmittance, [1, 1, 1]);
    for (let i = 1; i < distances.length; i++) {
        const direct = integrate(model, origin, ray, { maxDistance: distances[i], maxStep: 500 });
        for (let c = 0; c < 3; c++) { close(profile[i].radiance[c], direct.radiance[c], 1e-10); close(profile[i].transmittance[c], direct.transmittance[c], 1e-10); assert.ok(profile[i].transmittance[c] <= profile[i - 1].transmittance[c]); }
    }
});
test('volume lattice nodes reproduce their stored cumulative values', () => {
    const model = new Atmosphere({ solarSteps: 32 }), tree = new AtmosphereOctree(model), cam = camera();
    const volume = new FrustumVolume(model, tree, cam, { width: 4, height: 3, depth: 16, far: 120000, maxStep: 1000 }).build();
    for (const [x, y, z] of [[0, 0, 0], [1, 1, 8], [3, 2, 15]]) {
        const result = volume.lookup(x / 3, y / 2, volume.depths[z]);
        const i = ((z * volume.height + y) * volume.width + x) * 4;
        for (let c = 0; c < 3; c++) { close(result.radiance[c], volume.light[i + c], 1e-10); close(result.transmittance[c], volume.transmission[i + c], 1e-10); }
    }
    assert.equal(volume.sample(0.5, 0.5, 0).transmittance[0], 1);
});
test('hybrid finite-depth lookup agrees with independent ellipsoidal rays', () => {
    const model = new Atmosphere({ solarSteps: 64 }), cam = camera();
    const volume = new FrustumVolume(model, new AtmosphereOctree(model), cam, { width: 8, height: 6, depth: 48, far: 150000, maxStep: 1000 }).build();
    for (const u of [0.1, 0.5, 0.9]) for (const depth of [1000, 10000, 50000]) {
        const result = volume.sample(u, 0.4, depth), direct = integrate(model, origin, cam.ray(u, 0.4), { maxDistance: depth, maxStep: 500 });
        for (let c = 0; c < 3; c++) { close(result.radiance[c], direct.radiance[c], 0.001); close(result.transmittance[c], direct.transmittance[c], 0.002); }
    }
    assert.equal(volume.sample(0.5, 0.5, 500000).fallback, false); // Atmosphere ends before the volume's far plane.
});
test('out-of-range volume and horizon cells fall back instead of clamping silently', () => {
    const model = new Atmosphere({ solarSteps: 16 });
    const cam = new FrustumCamera([WGS84.semiMajorAxis + 2000, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const volume = new FrustumVolume(model, new AtmosphereOctree(model), cam, { width: 4, height: 4, depth: 8, far: 1000, maxStep: 4000 }).build();
    assert.equal(volume.lookup(0.5, 0.5, 1001), null);
    const result = volume.sample(0.5, 0.5, 100000);
    assert.equal(result.fallback, true); assert.ok(result.radiance.every(Number.isFinite));
    // A large volume is still forbidden from filtering across ground/sky angular neighbors.
    const horizon = new FrustumVolume(model, null, cam, { width: 4, height: 4, depth: 4, far: 1000000, maxStep: 10000 }).build();
    assert.ok(horizon.lookup(0.5, 0.5, 1000));
    assert.equal(horizon.lookup(0.5, 0.5, 100000), null);
});
test('two eyes own separate view volumes and share the spatial solar cache', () => {
    const model = new Atmosphere({ solarSteps: 16 }), tree = new AtmosphereOctree(model), cam = camera();
    const a = new FrustumVolume(model, tree, cam, { width: 2, height: 2, depth: 4, far: 20000 }).build();
    const other = new FrustumCamera(cam.origin.map((v, i) => v + 0.064 * cam.right[i]), cam.forward, cam.right, cam.up, cam.halfWidth, cam.halfHeight);
    const b = new FrustumVolume(model, tree, other, { width: 2, height: 2, depth: 4, far: 20000 }).build();
    assert.equal(a.tree, b.tree); assert.notEqual(a.light, b.light); assert.notDeepEqual(a.camera.origin, b.camera.origin);
});
test('invalid dimensions, basis and use before build fail early', () => {
    assert.throws(() => new FrustumCamera(origin, [1, 0, 0], [1, 0, 0], [0, 0, 1]));
    assert.throws(() => new FrustumVolume(new Atmosphere(), null, camera(), { depth: 1 }));
    assert.throws(() => new FrustumVolume(new Atmosphere(), null, camera()).lookup(0.5, 0.5, 1));
    assert.throws(() => integrateProfile(new Atmosphere(), origin, [1, 0, 0], [2, 1]));
});

test('ground-footprint protection avoids blending clipped columns at a planetary surface', () => {
    const model = new Atmosphere({ solarSteps: 16 });
    const cam = new FrustumCamera([WGS84.semiMajorAxis + 400000, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], 0.1, 0.1);
    const volume = new FrustumVolume(model, new AtmosphereOctree(model), cam, { width: 4, height: 4, depth: 16, far: 1000000, maxStep: 4000 }).build();
    const result = volume.sample(0.5, 0.5);
    assert.equal(result.fallback, true);
    assert.throws(() => { cam.origin[0] += 1; });
});
