import { performance } from 'node:perf_hooks';
import { WGS84, geodeticPosition, normalize } from './src/geometry.js';
import { Atmosphere } from './src/model.js';
import { AtmosphereOctree } from './src/octree.js';
import { integrate } from './src/integrator.js';
export function cameraRays(width, height, orbital = false) {
    const rays = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const u = (2 * (x + 0.5) / width - 1) * 0.7, v = (1 - 2 * (y + 0.5) / height) * 0.45;
        rays.push(normalize(orbital ? [-1, u, v] : [v + 0.15, 1, u]));
    }
    return rays;
}
function run(model, rays, origin, tree) {
    model.resetStats(); tree?.resetStats();
    const start = performance.now();
    const values = rays.map(d => integrate(model, origin, d, { tree, maxStep: 2000 }));
    return { ms: +(performance.now() - start).toFixed(2), ...model.stats, ...(tree ? tree.stats : {}), values };
}
const reports = [];
for (const [name, altitude, sun, orbital] of [
    ['ground-day', 2000, [1, 1, 0], false],
    ['ground-sunset', 2000, [0.02, 1, 0], false],
    ['orbit', 400000, [1, 1, 0], true]
]) {
    const model = new Atmosphere({ sun, solarSteps: 64 });
    const tree = new AtmosphereOctree(model);
    const rays = cameraRays(24, 12, orbital), origin = geodeticPosition(WGS84, 0, 0, altitude);
    const reference = run(model, rays, origin, null), cold = run(model, rays, origin, tree), warm = run(model, rays, origin, tree);
    let maxRadianceError = 0, sumSquared = 0, maxTransmittanceError = 0;
    for (let i = 0; i < rays.length; i++) for (let c = 0; c < 3; c++) {
        const difference = warm.values[i].radiance[c] - reference.values[i].radiance[c];
        maxRadianceError = Math.max(maxRadianceError, Math.abs(difference)); sumSquared += difference * difference;
        maxTransmittanceError = Math.max(maxTransmittanceError, Math.abs(warm.values[i].transmittance[c] - reference.values[i].transmittance[c]));
    }
    const compact = ({ values, ...stats }) => stats;
    reports.push({ name, rays: rays.length, nodes: tree.nodes, reference: compact(reference), cold: compact(cold), warm: compact(warm),
        warmSpeedup: +(reference.ms / warm.ms).toFixed(2), maxRadianceError, radianceRMSE: Math.sqrt(sumSquared / (rays.length * 3)), maxTransmittanceError });
}
console.log(JSON.stringify({ note: 'CPU wall-clock timings, not GPU measurements. Identical maxStep and solarSteps; octree splits introduce different quadrature positions. Warm view is unchanged.', reports }, null, 2));
