import { performance } from 'node:perf_hooks';
import { Atmosphere } from './src/model.js';
import { SolarOpticalLut } from './src/solar-lut.js';
import { integrate } from './src/integrator.js';
import { FrustumCamera } from './src/frustum.js';
import { WGS84 } from './src/geometry.js';
const reports = [];
for (const [name, sun] of [['day', [1, 1, 0.3]], ['sunset', [0.02, 1, 0]]]) {
    const model = new Atmosphere({ sun, solarSteps: 64 }), origin = [WGS84.semiMajorAxis + 2000, 0, 0];
    const camera = new FrustumCamera(origin, [0.15, 1, 0], [0, 0, 1], [1, -0.15, 0]), width = 32, height = 18, rays = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rays.push(camera.ray((x + 0.5) / width, (y + 0.5) / height));
    const render = lut => {
        model.resetStats(); lut?.resetStats(); const start = performance.now();
        const values = rays.map(ray => integrate(model, origin, ray, { solarLut: lut, maxStep: 2000 }));
        return { ms: performance.now() - start, ...model.stats, ...(lut ? lut.stats : {}), values };
    };
    const reference = render(null), qualities = [];
    for (const size of [[64, 16, 24], [128, 32, 32]]) {
        const lut = new SolarOpticalLut(model, { longitude: size[0], latitude: size[1], altitude: size[2], steps: 64 });
        const buildStart = performance.now(); lut.build(); const buildMs = performance.now() - buildStart;
        const rendered = render(lut); let squared = 0, maximum = 0;
        rendered.values.forEach((value, i) => value.radiance.forEach((v, c) => { const e = Math.abs(v - reference.values[i].radiance[c]); squared += e * e; maximum = Math.max(maximum, e); }));
        const { values, ...stats } = rendered;
        qualities.push({ size, textureBytesGPU: lut.bytes, buildMsCPU: buildMs, renderCPU: stats, warmCpuSpeedup: reference.ms / rendered.ms,
            totalCpuSpeedupIncludingOneBuild: reference.ms / (buildMs + rendered.ms), radianceRMSE: Math.sqrt(squared / (rays.length * 3)), maxRadianceError: maximum });
    }
    const { values, ...direct } = reference;
    reports.push({ name, output: [width, height], directCPU: direct, qualities });
}
console.log(JSON.stringify({ note: 'CPU reference experiment. GPU stores RGBA16F while these CPU tables use float32. One global optical table, fixed solar declination. These are not GPU performance measurements.', reports }, null, 2));
