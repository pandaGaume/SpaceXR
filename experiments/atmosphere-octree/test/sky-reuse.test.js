import test from 'node:test';
import assert from 'node:assert/strict';
import { Atmosphere } from '../src/model.js';
import { WGS84, geodeticPosition } from '../src/geometry.js';
import { FrustumCamera } from '../src/frustum.js';
import { skyBasis } from '../src/sky-view.js';
import { geographicCoordinates } from '../src/solar-lut.js';
import { horizonSensitivity, predictedHorizonShift, measuredHorizonShift, movedCamera, colorBudget, colorResidual, reuseScore, reuseDuration } from '../src/sky-reuse.js';
const model = new Atmosphere(), origin = geodeticPosition(WGS84, 0.6, 0.3, 60000), basis = skyBasis(WGS84, origin);
const camera = new FrustumCamera(origin, basis.east, basis.north, basis.up, 0.8, 0.45);
const geometry = horizonSensitivity(WGS84, camera, 1920, 1080);
test('ellipsoidal silhouette Jacobian predicts independently solved displaced conics', () => {
    assert.ok(geometry.points.length >= 30);
    for (const offset of [[0,0,1], [100,0,0], [0,100,0], [50,-30,2]]) {
        const shifted = movedCamera(model, camera, basis, offset);
        const delta = shifted.origin.map((v,i) => v-origin[i]);
        const prediction = predictedHorizonShift(geometry, delta), measured = measuredHorizonShift(WGS84, shifted, geometry);
        assert.ok(Math.abs(prediction-measured) < Math.max(1e-6, measured*0.005), `${prediction} vs ${measured}`);
    }
});
test('doubling image definition doubles projected displacement', () => {
    const high = horizonSensitivity(WGS84, camera, 3840, 2160);
    assert.ok(Math.abs(predictedHorizonShift(high, basis.up) / predictedHorizonShift(geometry, basis.up)-2) < 1e-10);
});
test('horizontal camera displacement follows geodetic altitude', () => {
    const shifted = movedCamera(model, camera, basis, [10000, 5000, 0]);
    assert.ok(Math.abs(geographicCoordinates(WGS84, shifted.origin).height-60000) < 1e-6);
    assert.ok(shifted.forward.every((v,i) => Math.abs(v-camera.forward[i]) < 1e-14));
});
test('color criterion bounds a signed linear RGB sensitivity for mixed moves', () => {
    const jacobian = [[0.03,-0.02,0.4],[-0.01,0.05,-0.2]], s = [0.03,0.05,0.4], delta=[10,-20,2];
    for (const row of jacobian) assert.ok(Math.abs(row.reduce((sum,x,i)=>sum+x*delta[i],0)) <= colorBudget(s,delta));
});
test('display residual uses eight-bit display codes and accounts for transmitted ground', () => {
    const a=[{radiance:[0.1,0.2,0.3],transmittance:[1,1,1]}], b=[{radiance:[0.1,0.2,0.3],transmittance:[0,0,0]}];
    assert.deepEqual(colorResidual(a,a,[true],1),[0,0,0]);
    assert.deepEqual(colorResidual(a,b,[false],1),[0,0,0]);
    assert.ok(colorResidual(a,b,[true],1).every(x=>x>0 && x<255));
});

test('reuse duration respects both budgets for mixed constant velocity', () => {
    const velocity=[120,-40,3], sensitivities=[0.0005,0.00014,0.0025];
    const duration=reuseDuration(geometry,basis,sensitivities,velocity);
    assert.ok(Number.isFinite(duration) && duration > 0);
    assert.ok(Math.abs(reuseScore(geometry,basis,sensitivities,velocity.map(v=>v*duration))-0.5)<1e-12);
    assert.equal(reuseDuration(geometry,basis,sensitivities,[0,0,0]),Infinity);
});
