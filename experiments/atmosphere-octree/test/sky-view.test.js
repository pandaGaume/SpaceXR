import test from 'node:test';
import assert from 'node:assert/strict';
import { Atmosphere } from '../src/model.js';
import { FrustumCamera } from '../src/frustum.js';
import { WGS84, dot, geodeticPosition, intersectEllipsoid } from '../src/geometry.js';
import { skyBasis, skyDirection, horizonElevation, skyElevationFromUnit, skyUnitFromElevation, makeSkyViewLayout, skyTextureCoordinates, cameraForDisplay } from '../src/sky-view.js';
const model = new Atmosphere();
const origin = geodeticPosition(WGS84, 0.8, 0.3, 60000), basis = skyBasis(WGS84, origin);
const close = (a, b, epsilon) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);

test('ellipsoidal horizon brackets actual tangent rays and varies by azimuth', () => {
    const elevations = [];
    for (const azimuth of [0, Math.PI / 2, Math.PI]) {
        const h = horizonElevation(WGS84, origin, basis, azimuth); elevations.push(h);
        const below = intersectEllipsoid(WGS84, origin, skyDirection(basis, azimuth, h - 1e-6));
        const above = intersectEllipsoid(WGS84, origin, skyDirection(basis, azimuth, h + 1e-6));
        assert.ok(below && below[0] > 0); assert.equal(above, null);
    }
    assert.ok(Math.max(...elevations) - Math.min(...elevations) > 1e-6);
});
test('local sky basis is orthonormal at the equator, mid-latitudes and poles', () => {
    for (const latitude of [-Math.PI / 2, 0, 0.8, Math.PI / 2]) {
        const b = skyBasis(WGS84, geodeticPosition(WGS84, latitude, 0.4, 2000));
        for (const v of [b.east, b.north, b.up]) close(dot(v, v), 1, 1e-12);
        close(dot(b.east, b.north), 0, 1e-12); close(dot(b.east, b.up), 0, 1e-12); close(dot(b.north, b.up), 0, 1e-12);
    }
});
test('nonlinear elevation maps invert on both sides of the horizon', () => {
    for (const h of [-0.01, -0.2, -0.8]) for (const ground of [false, true]) for (const t of [0, 0.01, 0.3, 0.8, 1]) close(skyUnitFromElevation(skyElevationFromUnit(t, h, ground), h, ground), t, 1e-7);
});
test('sky and ground occupy separate texture rows without filtering across the silhouette', () => {
    const layout = makeSkyViewLayout(model, origin, { width: 32, hemisphereRows: 8, samples: 16 });
    const h = layout.horizon[4], azimuth = 4 / 32 * 2 * Math.PI;
    const above = skyTextureCoordinates(layout, skyDirection(layout.basis, azimuth, h + 1e-7));
    const below = skyTextureCoordinates(layout, skyDirection(layout.basis, azimuth, h - 1e-7));
    assert.equal(above.ground, false); assert.equal(below.ground, true);
    assert.ok(above.v < 0.5); assert.ok(below.v > 0.5);
});
test('azimuth is periodic and does not alter reconstructed elevation near the seam', () => {
    const layout = makeSkyViewLayout(model, origin, { width: 32, hemisphereRows: 8, samples: 16 });
    const a = skyTextureCoordinates(layout, skyDirection(layout.basis, 1e-8, 0.2));
    const b = skyTextureCoordinates(layout, skyDirection(layout.basis, 2 * Math.PI - 1e-8, 0.2));
    close(a.v, b.v, 1e-6); close(a.horizon, b.horizon, 1e-6);
});
test('native HD camera preserves aspect ratio and square angular pixels', () => {
    const camera = new FrustumCamera(origin, basis.north, basis.east, basis.up, 0.7, 0.45);
    const hd = cameraForDisplay(camera, 1920, 1080);
    close(hd.halfWidth / hd.halfHeight, 1920 / 1080, 1e-12);
    close(2 * hd.halfWidth / 1920, 2 * hd.halfHeight / 1080, 1e-12);
    assert.deepEqual(hd.origin, camera.origin);
});
test('Sky-View memory and invalid layouts are explicit', () => {
    const layout = makeSkyViewLayout(model, origin, { width: 128, hemisphereRows: 32, samples: 32 });
    assert.equal(layout.bytes, 128 * 64 * 8 * 3);
    assert.throws(() => makeSkyViewLayout(model, origin, { width: 1 }));
    assert.throws(() => makeSkyViewLayout(model, [0, 0, 0]));
    assert.throws(() => cameraForDisplay({}, 0, 1080));
});
