import { performance } from 'node:perf_hooks';
import { WGS84 } from './src/geometry.js';
import { Atmosphere } from './src/model.js';
import { AtmosphereOctree } from './src/octree.js';
import { integrate } from './src/integrator.js';
import { FrustumCamera, FrustumVolume } from './src/frustum.js';
const reports = [];
for (const name of ['ground-day', 'ground-sunset', 'orbit', 'terrain-depth-step']) {
    const orbital = name === 'orbit', m = new Atmosphere({ sun: name === 'ground-sunset' ? [0.02, 1, 0] : [1, 1, 0.3] });
    const tree = new AtmosphereOctree(m), origin = [WGS84.semiMajorAxis + (orbital ? 400000 : 2000), 0, 0];
    const camera = orbital ? new FrustumCamera(origin, [-1, 0, 0], [0, 1, 0], [0, 0, 1]) : new FrustumCamera(origin, [0.15, 1, 0], [0, 0, 1], [1, -0.15, 0]);
    const width = 48, height = 27, depth = u => name === 'terrain-depth-step' ? (u < 0.5 ? 5000 : 20000) : Infinity;
    const pass = fn => {
        const start = performance.now(), values = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) values.push(fn((x + 0.5) / width, (y + 0.5) / height));
        return { ms: performance.now() - start, values };
    };
    m.resetStats();
    const direct = pass((u, v) => integrate(m, origin, camera.ray(u, v), { maxDistance: depth(u), maxStep: 2000 }));
    const directStats = { ms: direct.ms, ...m.stats };
    const qualities = [];
    for (const size of [12, 24]) {
        const volume = new FrustumVolume(m, tree, camera, { width: size, height: size * 2 / 3, depth: size === 12 ? 48 : 64, far: name === 'terrain-depth-step' ? 20000 : 2000000, maxStep: 2000 });
        m.resetStats(); tree.resetStats(); const start = performance.now(); volume.build();
        const build = { ms: performance.now() - start, ...m.stats, ...tree.stats };
        m.resetStats();
        const sampled = pass((u, v) => volume.sample(u, v, depth(u)));
        let squared = 0, maxRadianceError = 0, maxTransmittanceError = 0;
        sampled.values.forEach((value, i) => value.radiance.forEach((v, c) => {
            const error = Math.abs(v - direct.values[i].radiance[c]); squared += error * error; maxRadianceError = Math.max(maxRadianceError, error);
            maxTransmittanceError = Math.max(maxTransmittanceError, Math.abs(value.transmittance[c] - direct.values[i].transmittance[c]));
        }));
        qualities.push({ dimensions: [volume.width, volume.height, volume.depth], bytes: volume.bytes, build,
            reconstruct: { ms: sampled.ms, ...m.stats, fallbacks: volume.stats.fallbacks, lookups: volume.stats.lookups },
            totalSpeedup: direct.ms / (build.ms + sampled.ms), reconstructionOnlySpeedup: direct.ms / sampled.ms,
            radianceRMSE: Math.sqrt(squared / (width * height * 3)), maxRadianceError, maxTransmittanceError });
    }
    reports.push({ name, output: [width, height], direct: directStats, qualities });
}
console.log(JSON.stringify({ note: 'CPU measurements. Total includes volume construction and conservative direct fallbacks. Octree is persistent between quality runs, so the second quality uses a warmer solar cache. Reconstruction-only timing is not full frame timing.', reports }, null, 2));
