import test from 'node:test';
import assert from 'node:assert/strict';
import { WGS84, geodeticPosition } from '../src/geometry.js';
import { Atmosphere } from '../src/model.js';
import { integrate } from '../src/integrator.js';
import { SolarOpticalLut, solarOpticalColumns, wrapLongitude } from '../src/solar-lut.js';
const m = new Atmosphere({ sun: [1, 0, 0.2], solarSteps: 64 });
const lut = new SolarOpticalLut(m, { longitude: 64, latitude: 16, altitude: 24, steps: 64 }).build();
const close = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}, tolerance ${tolerance}`);

test('optical columns reconstruct the direct spectral transmittance', () => {
    const p = geodeticPosition(WGS84, 0.3, 0.2, 3000), columns = solarOpticalColumns(m, p);
    const direct = m.solarTransmittance(p);
    for (let c = 0; c < 3; c++) close(Math.exp(-(m.rayleigh[c] * columns[0] + m.mieExtinction * columns[1])), direct[c], 1e-12);
});
test('LUT nodes agree with the direct solar integral away from the ground boundary', () => {
    for (const [x, y, z] of [[32, 8, 8], [34, 10, 16], [28, 4, 5]]) {
        const p = lut.position(x, y, z), cached = lut.transmittance(p), direct = m.solarTransmittance(p);
        for (let c = 0; c < 3; c++) close(cached[c], direct[c], 1e-6);
    }
});
test('longitude is periodic with no seam at minus/plus pi', () => {
    const day = new Atmosphere({ sun: [-1, 0, 0], solarSteps: 32 });
    const table = new SolarOpticalLut(day, { longitude: 32, latitude: 8, altitude: 12, steps: 32 }).build();
    const a = table.transmittance(geodeticPosition(WGS84, 0.2, -Math.PI + 1e-8, 5000));
    const b = table.transmittance(geodeticPosition(WGS84, 0.2, Math.PI - 1e-8, 5000));
    for (let c = 0; c < 3; c++) close(a[c], b[c], 1e-7);
    close(wrapLongitude(5 * Math.PI), -Math.PI, 1e-12);
});
test('planet shadows and unsafe terminator cells use physical visibility or direct fallback', () => {
    const night = geodeticPosition(WGS84, 0, Math.PI, 1000);
    assert.deepEqual(lut.transmittance(night), [0, 0, 0]);
    let fallbackFound = false;
    for (let longitude = 1.55; longitude < 1.66; longitude += 0.003) {
        const p = geodeticPosition(WGS84, 0.3, longitude, 1000), before = lut.stats.fallbacks, value = lut.transmittance(p);
        if (lut.stats.fallbacks > before) { fallbackFound = true; assert.deepEqual(value, m.solarTransmittance(p)); }
    }
    assert.ok(fallbackFound);
});
test('azimuthal Sun rotation reuses the same table, changed declination is rejected', () => {
    const angle = 0.7, rotated = new Atmosphere({ sun: [Math.cos(angle), Math.sin(angle), 0.2], solarSteps: 64 });
    const p = geodeticPosition(WGS84, 0.4, 0.3, 5000), q = geodeticPosition(WGS84, 0.4, 0.3 + angle, 5000);
    const a = lut.transmittance(p), b = lut.transmittance(q, rotated);
    for (let c = 0; c < 3; c++) close(a[c], b[c], 1e-7);
    assert.throws(() => lut.assertCompatible(new Atmosphere({ sun: [1, 0, 0.3] })));
});
test('optical coefficients change without invalidating geometric density columns', () => {
    const other = new Atmosphere({ sun: [1, 0, 0.2], rayleigh: m.rayleigh.map(x => x * 2), mieExtinction: m.mieExtinction * 2 });
    const p = geodeticPosition(WGS84, 0.2, 0.1, 5000), a = lut.transmittance(p), b = lut.transmittance(p, other);
    for (let c = 0; c < 3; c++) close(b[c], a[c] ** 2, 1e-12);
    assert.throws(() => lut.assertCompatible(new Atmosphere({ sun: [1, 0, 0.2], mieHeight: 2000 })));
});
test('single-scattering renderer uses the LUT instead of nested solar integration', () => {
    const origin = geodeticPosition(WGS84, 0.3, 0.2, 10000), direction = [1, 0.1, 0.2];
    const direct = integrate(m, origin, direction, { maxStep: 1000, maxDistance: 50000 });
    lut.resetStats(); m.resetStats();
    const result = integrate(m, origin, direction, { solarLut: lut, maxStep: 1000, maxDistance: 50000 });
    assert.ok(lut.stats.hits > 0); assert.equal(m.stats.solarIntegrations, 0);
    for (let c = 0; c < 3; c++) close(result.radiance[c], direct.radiance[c], 0.0005);
});
test('invalid layouts and unbuilt table fail early', () => {
    assert.throws(() => new SolarOpticalLut(m, { longitude: 1 }));
    assert.throws(() => new SolarOpticalLut(m).transmittance([7000000, 0, 0]));
});
import { longitudeFromUnit, longitudeToUnit } from '../src/solar-lut.js';
import { FrustumCamera, FrustumVolume } from '../src/frustum.js';
test('terminator-focused longitude mapping is invertible across latitudes and Sun declinations', () => {
    for (const latitude of [-1.56, -1, 0, 1, 1.56]) for (const sunZ of [0, 0.2, 0.8]) for (const u of [0, 0.1, 0.499, 0.5, 0.7, 1]) {
        close(longitudeToUnit(longitudeFromUnit(u, latitude, sunZ), latitude, sunZ), u, 1e-7);
    }
});
test('folding opposite relative longitudes preserves ellipsoidal optical depth exactly', () => {
    const angle = Math.atan2(m.sun[1], m.sun[0]);
    const a = geodeticPosition(WGS84, 0.4, angle + 1.4, 10000), b = geodeticPosition(WGS84, 0.4, angle - 1.4, 10000);
    const ta = m.solarTransmittance(a), tb = m.solarTransmittance(b), ca = lut.transmittance(a), cb = lut.transmittance(b);
    for (let c = 0; c < 3; c++) { close(ta[c], tb[c], 1e-12); close(ca[c], cb[c], 1e-10); }
});
test('GPU camera metadata requires no CPU integration or CPU volume allocation', () => {
    m.resetStats();
    const camera = new FrustumCamera([WGS84.semiMajorAxis + 2000, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const volume = new FrustumVolume(m, null, camera, { width: 4, height: 4, depth: 8, far: 20000, allocateData: false });
    assert.equal(volume.light.length, 0); assert.equal(volume.transmission.length, 0);
    assert.ok(volume.coordinates(0.5, 0.5, 1000)); assert.equal(m.stats.solarIntegrations, 0); assert.equal(m.stats.densityEvaluations, 0);
});
import { atmosphereRegime } from '../src/gpu.js';
test('inside and space variants are selected by geodetic altitude, including polar views', () => {
    for (const latitude of [0, 0.8, Math.PI / 2]) {
        assert.equal(atmosphereRegime(m, geodeticPosition(WGS84, latitude, 0.4, m.top - 1)), 'internal');
        assert.equal(atmosphereRegime(m, geodeticPosition(WGS84, latitude, 0.4, m.top + 1)), 'external');
    }
    assert.equal(atmosphereRegime(m, geodeticPosition(WGS84, 0, 0, 60000)), 'internal');
    assert.equal(atmosphereRegime(m, geodeticPosition(WGS84, 0, 0, 400000)), 'external');
});
import { solarGrazesGround } from '../src/solar-lut.js';
test('grazing sunlight gets a direct fallback even when every interpolation corner is lit', () => {
    const p = geodeticPosition(WGS84, 0, 1.61, 10000), before = lut.stats.fallbacks;
    assert.equal(solarGrazesGround(m, p, 20000), true);
    assert.deepEqual(lut.transmittance(p), m.solarTransmittance(p));
    assert.ok(lut.stats.fallbacks > before);
    assert.equal(solarGrazesGround(m, geodeticPosition(WGS84, 0, 0, 1000), 20000), false);
});
