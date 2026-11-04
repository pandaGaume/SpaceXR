import { makePhysicalScene, physicalPresets } from './src/spectrum.js';
import { calibrateSkyReuse } from './src/sky-reuse.js';
import { cameraForDisplay, cameraWithHorizontalFov, cameraFramingSun, projectedSolarDisk, skyBasis, horizonElevation } from './src/sky-view.js';
import { GpuSkyView } from './src/sky-view.gpu.js';
import { GpuSolarOpticalLut } from './src/solar-lut.gpu.js';
import { solarSignature } from './src/solar-lut.js';
import { FrustumCamera, FrustumVolume } from './src/frustum.js';
import { GpuFrustumVolume } from './src/frustum.gpu.js';
import { WGS84, geodeticPosition } from './src/geometry.js';
import { Atmosphere } from './src/model.js';
import { AtmosphereOctree } from './src/octree.js';
import { integrate } from './src/integrator.js';
import { GpuAtmosphere } from './src/gpu.js';
const $ = id => document.getElementById(id);
let current = null, gpu = null;
var hdState = null;
const yieldUI = () => new Promise(resolve => setTimeout(resolve, 0));
function readPhysicalConfig() {
    return { planet: $('physicalPlanet').value, pressure: +$('pressure').value, temperature: +$('gasTemperature').value, gravity: +$('gravity').value,
        mix: Object.fromEntries(['N2','O2','CO2','Ar'].map(g => [g, +$('gas'+g).value])),
        dustTau: +$('dustTau').value, dustHeight: +$('dustHeight').value, radiusUm: +$('dustRadius').value, logSigma: +$('dustSigma').value, indexN: +$('dustN').value, indexK: +$('dustK').value,
        source: $('stellarSource').value, starTemperature: +$('starTemperature').value, distanceAU: +$('starDistance').value, bandCenter: +$('bandCenter').value, bandWidth: +$('bandWidth').value, wavelengths: +$('spectralSamples').value };
}
function setup() {
    const view = $('view').value, sunlight = $('sun').value;
    const physicalConfig = $('transport').value === 'spectral' ? readPhysicalConfig() : null;
    const key = JSON.stringify([view,sunlight,$("seams").value,physicalConfig,$('solarElevation').value,$('physicalAltitude').value]);
    if (!current || current.key !== key) {
        const sun = view === 'dawn' ? [-0.05, 1, 0] : sunlight === 'day' ? [1, 1, 0.3] : sunlight === 'sunset' ? [0.02, 1, 0] : [-1, 0, 0];
        const polar = view === 'polar';
        const elevation = +$('solarElevation').value * Math.PI / 180;
        const physicalSun = polar ? [0,Math.cos(elevation),Math.sin(elevation)] : [Math.sin(elevation),Math.cos(elevation),0];
        const spectral = physicalConfig ? makePhysicalScene(physicalConfig,physicalSun) : null;
        const model = spectral?.model ?? new Atmosphere({ sun: polar ? [sun[2], sun[1], sun[0]] : sun });
        const orbital = view === 'orbit' || view === 'limb';
        current = { key, model, spectral, tree: new AtmosphereOctree(model, { seamBlendFraction: Number($("seams").value) }), origin: geodeticPosition(model.ellipsoid, polar ? Math.PI / 2 : 0, 0, spectral ? +$('physicalAltitude').value : view === 'dawn' ? 60000 : orbital ? 400000 : 2000), values: null };
    }
    const width = Number($('resolution').value), height = width * 9 / 16, rays = [];
    let forward = [0.15, 1, 0], right = [0, 0, 1], up = [1, -0.15, 0], halfWidth = 0.7, halfHeight = 0.45;
    if (view === 'dawn') { forward = [-0.1, 1, 0]; up = [1, 0.1, 0]; }
    if (view === 'orbit') { forward = [-1, 0, 0]; right = [0, 1, 0]; up = [0, 0, 1]; }
    if (view === 'limb') { forward = [-0.35, 1, 0]; up = [1, 0.35, 0]; halfWidth = 0.21; halfHeight = 0.1;
        if (current.spectral) { const h = horizonElevation(current.model.ellipsoid,current.origin,skyBasis(current.model.ellipsoid,current.origin),0); forward = [Math.sin(h),Math.cos(h),0]; up = [Math.cos(h),-Math.sin(h),0]; }
    }
    if (view === 'polar') { forward = [0, 1, 0.15]; right = [1, 0, 0]; up = [0, -0.15, 1]; }
    const camera = new FrustumCamera(current.origin, forward, right, up, halfWidth, halfHeight);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rays.push(camera.ray((x + 0.5) / width, (y + 0.5) / height));
    return { ...current, camera, width, height, rays };
}
function draw(id, values, width, height) {
    const canvas = $(id); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'), image = context.createImageData(width, height), exposure = Number($('exposure').value);
    values.forEach((value, i) => {
        for (let c = 0; c < 3; c++) image.data[i * 4 + c] = Math.round(255 * Math.pow(1 - Math.exp(-exposure * value.radiance[c]), 1 / 2.2));
        image.data[i * 4 + 3] = 255;
    });
    context.putImageData(image, 0, 0);
}
async function cpuPass(scene, tree) {
    scene.model.resetStats(); tree?.resetStats();
    const start = performance.now(), values = [];
    for (let i = 0; i < scene.rays.length; i++) {
        values.push(integrate(scene.model, scene.origin, scene.rays[i], { tree, maxStep: 2000 }));
        if (i % 96 === 0) await yieldUI();
    }
    return { values, ms: +(performance.now() - start).toFixed(1), ...scene.model.stats, ...(tree ? tree.stats : {}) };
}
function drawError(a, b, width, height) {
    const canvas = $('error'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'), image = context.createImageData(width, height);
    a.forEach((v, i) => {
        const error = Math.min(1, Math.max(...v.radiance.map((x, c) => Math.abs(x - b[i].radiance[c]))) * 10000);
        image.data[i * 4] = 255 * error; image.data[i * 4 + 1] = 200 * error; image.data[i * 4 + 2] = 80 * error; image.data[i * 4 + 3] = 255;
    });
    context.putImageData(image, 0, 0);
}
function compare(a, b) {
    let sum = 0, max = 0, transmission = 0;
    a.forEach((r, i) => r.radiance.forEach((v, c) => {
        const error = Math.abs(v - b[i].radiance[c]); sum += error * error; max = Math.max(max, error);
        transmission = Math.max(transmission, Math.abs(r.transmittance[c] - b[i].transmittance[c]));
    }));
    return { radianceRMSE: Math.sqrt(sum / (a.length * 3)), maxRadianceError: max, maxTransmittanceError: transmission };
}
const compact = ({ values, ...stats }) => stats;
async function render(useGPU = false) {
    setBusy(true);
    try {
        const s = setup();
        $('status').textContent = 'Calcul de la reference et preparation du cache...'; await yieldUI();
        const reference = await cpuPass(s, null), cold = await cpuPass(s, s.tree), warm = await cpuPass(s, s.tree);
        let a = reference, b = warm;
        const report = { cpuReference: compact(reference), cpuCachePreparation: compact(cold), cpuWarm: compact(warm), nodes: s.tree.nodes, error: compare(reference.values, warm.values) };
        if (useGPU) {
            $('status').textContent = 'Compilation WGSL et comparaison WebGPU...'; await yieldUI();
            gpu ??= await GpuAtmosphere.create();
            a = await gpu.render(s.model, s.tree, s.origin, s.rays, false);
            b = await gpu.render(s.model, s.tree, s.origin, s.rays, true);
            report.webgpuIncludingUploadAndReadback = { referenceMs: a.ms, cachedMs: b.ms, referenceGpuMs: a.gpuMs, cachedGpuMs: b.gpuMs, cacheHits: b.cacheHits, directCalls: b.directCalls, cacheError: compare(a.values, b.values), cpuReferenceError: compare(reference.values, a.values) };
        }
        draw('reference', a.values, s.width, s.height); draw('accelerated', b.values, s.width, s.height); drawError(a.values, b.values, s.width, s.height);
        current.values = { a: a.values, b: b.values, width: s.width, height: s.height };
        $('status').textContent = JSON.stringify(report, null, 2);
        window.atmosphereResult = report;
    } catch (error) { $('status').textContent = `${error.stack || error}`; window.atmosphereError = String(error); }
    finally { setBusy(false); }
}
$('render').onclick = () => render(false);
$('gpu').disabled = !navigator.gpu;
$('gpu').onclick = () => render(true);
$('exposure').oninput = () => {
    if (current?.values) { const v = current.values; draw('reference', v.a, v.width, v.height); draw('accelerated', v.b, v.width, v.height); }
};
if (new URLSearchParams(location.search).has('auto')) render(new URLSearchParams(location.search).has('gpu'));

// Format experiment: same lattice and rays, three memory representations.
import { buildSolarGrid } from './src/grid.js';
$('layouts').disabled = !navigator.gpu;
$('layouts').onclick = async () => {
    setBusy(true);
    const devices = [];
    try {
        const s = setup();
        $('status').textContent = 'Preparation de la grille solaire commune (32 cubique)...'; await yieldUI();
        const start = performance.now(), grid = buildSolarGrid(s.model, s.origin, s.rays, 32);
        const report = { rays: s.rays.length, dimension: 32, gridBuildMs: performance.now() - start, validCells: grid.flags.reduce((a, b) => a + b, 0),
            timing: 'gpuMs mesure la passe seule si timestamp-query est disponible. ms inclut les transferts et la lecture retour. Trois mesures apres une passe de chauffe.', formats: {} };
        let reference;
        for (const layout of ['buffer', 'texture3d', 'atlas2d']) {
            $('status').textContent = `Compilation et mesures : ${layout}...`; await yieldUI();
            const renderer = await GpuAtmosphere.create(layout); devices.push(renderer);
            if (!reference) reference = await renderer.render(s.model, s.tree, s.origin, s.rays, false, 2000, grid);
            await renderer.render(s.model, s.tree, s.origin, s.rays, true, 2000, grid);
            const runs = [];
            for (let i = 0; i < 3; i++) runs.push(await renderer.render(s.model, s.tree, s.origin, s.rays, true, 2000, grid));
            const last = runs[2], gpuTimes = runs.map(r => r.gpuMs).filter(v => v !== null).sort((a, b) => a - b);
            report.formats[layout] = { storage: layout === 'buffer' ? 'RGBA32F, interpolation manuelle' : 'RGBA16F, filtrage materiel',
                latticeBytes: grid.dimension ** 3 * (layout === 'buffer' ? 16 : 8) + grid.flags.byteLength,
                cacheHits: last.cacheHits, directCalls: last.directCalls, ms: runs.map(r => r.ms), gpuMs: runs.map(r => r.gpuMs), medianGpuMs: gpuTimes.length ? gpuTimes[1] : null,
                error: compare(reference.values, last.values) };
            if (layout === 'texture3d') { draw('reference', reference.values, s.width, s.height); draw('accelerated', last.values, s.width, s.height); drawError(reference.values, last.values, s.width, s.height); }
        }
        $('status').textContent = JSON.stringify(report, null, 2);
    } catch (error) { $('status').textContent = String(error.stack || error); }
    finally { devices.forEach(d => d.dispose()); setBusy(false); }
};


function setBusy(busy) {
    if (busy) stopHdAnimation();
    for (const id of ['render', 'gpu', 'layouts', 'hybrid', 'hybridgpu', 'solarlut', 'solarlutvolume', 'renderhd', 'animatehd', 'fullscreenhd', 'savehd', 'calibratehd', 'reporthd']) $(id).disabled = busy || (['gpu', 'layouts', 'hybridgpu', 'solarlut', 'solarlutvolume', 'renderhd', 'animatehd', 'fullscreenhd', 'savehd', 'calibratehd', 'reporthd'].includes(id) && !navigator.gpu);
    for (const select of document.querySelectorAll('select')) select.disabled = busy;
    $('animatehd').disabled = busy || !hdState?.renderer;
    $('fullscreenhd').disabled = busy || !hdState?.renderer;
    $('savehd').disabled = busy || !hdState?.renderer;
    $('calibratehd').disabled = busy || !hdState?.renderer || !!hdState?.renderer?.spectral;
    for (const id of ['render','gpu','layouts','hybrid','hybridgpu','solarlut','solarlutvolume']) if ($('transport').value === 'spectral') $(id).disabled = true;
    for (const input of document.querySelectorAll('fieldset input')) input.disabled = busy;
    if ($('transport').value === 'spectral') for (const id of ['sun','resolution','seams','volumeSize','sceneDepth']) $(id).disabled = true;
    $('reporthd').disabled = busy || !hdState?.renderer;
}
function sceneDepth(u) {
    const value = $('sceneDepth').value;
    return value === 'sky' ? Infinity : value === 'terrain' ? 10000 : u < 0.5 ? 5000 : 20000;
}
function drawComposite(id, values, width, height) {
    const terrain = $('sceneDepth').value !== 'sky';
    const composed = values.map(value => ({ radiance: value.radiance.map((v, c) => v + (terrain ? [0.06, 0.08, 0.04][c] * value.transmittance[c] : 0)) }));
    draw(id, composed, width, height);
}
async function hybrid(useGPU) {
    setBusy(true); let renderer;
    try {
        const s = setup(), size = Number($('volumeSize').value);
        const options = { width: size, height: Math.round(size * 2 / 3), depth: size === 12 ? 48 : 64, far: $('sceneDepth').value === 'sky' ? 2000000 : $('sceneDepth').value === 'terrain' ? 10000 : 20000, maxStep: 2000 };
        $('status').textContent = 'Reference directe aux profondeurs de la scene...'; await yieldUI();
        s.model.resetStats(); const reference = [], referenceStart = performance.now();
        for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
            const u = (x + 0.5) / s.width, v = (y + 0.5) / s.height;
            reference.push(integrate(s.model, s.origin, s.camera.ray(u, v), { maxDistance: sceneDepth(u), maxStep: 2000 }));
            if ((x + y * s.width) % 96 === 0) await yieldUI();
        }
        const report = { mode: 'octree solaire + volume camera', output: [s.width, s.height], volume: [options.width, options.height, options.depth],
            directCPU: { ms: performance.now() - referenceStart, ...s.model.stats } };
        $('status').textContent = 'Construction cumulative du volume, avec cache solaire octree...'; await yieldUI();
        const volume = new FrustumVolume(s.model, s.tree, s.camera, options);
        s.model.resetStats(); s.tree.resetStats(); const buildStart = performance.now(); volume.build();
        report.volumeBuildCPU = { ms: performance.now() - buildStart, ...s.model.stats, ...s.tree.stats, integratedSamples: volume.stats.integratedSamples, bytes: volume.bytes };
        s.model.resetStats(); const sampleStart = performance.now(), values = [];
        for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
            const u = (x + 0.5) / s.width, v = (y + 0.5) / s.height;
            values.push(volume.sample(u, v, sceneDepth(u)));
            if ((x + y * s.width) % 192 === 0) await yieldUI();
        }
        report.reconstructionCPU = { ms: performance.now() - sampleStart, fallbacks: volume.stats.fallbacks, lookups: volume.stats.lookups, ...s.model.stats };
        report.errorCPU = compare(reference, values);
        let result = values;
        if (useGPU) {
            $('status').textContent = 'Construction GPU du volume et lecture des textures 3D...'; await yieldUI();
            gpu ??= await GpuAtmosphere.create(); renderer = await GpuFrustumVolume.create(gpu.device, gpu);
            report.directGPU = compact(await gpu.render(s.model, s.tree, s.origin, s.rays.map((ray, i) => [...ray, sceneDepth((i % s.width + 0.5) / s.width)]), false));
            report.volumeBuildGPU = await renderer.build(volume);
            await renderer.sample(s.width, s.height, sceneDepth);
            const sampled = await renderer.sample(s.width, s.height, sceneDepth);
            report.reconstructionGPU = compact(sampled); report.errorGPU = compare(reference, sampled.values); report.gpuVersusCPUVolume = compare(values, sampled.values);
            result = sampled.values;
        }
        drawComposite('reference', reference, s.width, s.height); drawComposite('accelerated', result, s.width, s.height); drawError(reference, result, s.width, s.height);
        current.values = { a: reference, b: result, width: s.width, height: s.height, composite: true };
        $('status').textContent = JSON.stringify(report, null, 2); window.atmosphereResult = report;
    } catch (error) { $('status').textContent = String(error.stack || error); }
    finally { renderer?.dispose(); setBusy(false); }
}
$('hybrid').onclick = () => hybrid(false);
$('hybridgpu').onclick = () => hybrid(true);
$('hybridgpu').disabled = !navigator.gpu;
$('exposure').oninput = () => {
    if (current?.values) {
        const v = current.values, display = v.composite ? drawComposite : draw;
        display('reference', v.a, v.width, v.height); display('accelerated', v.b, v.width, v.height);
    }
};

const persistentSolarLuts = new Map();
let solarLutRenderer;
async function runSolarLut(withVolume = false) {
    setBusy(true); let volumeRenderer;
    try {
        const s = setup(), quality = Number($('solarLutSize').value), size = quality === 128 ? [128, 32, 32] : [256, 64, 48];
        $('status').textContent = 'Compilation des shaders de LUT solaire...'; await yieldUI();
        gpu ??= await GpuAtmosphere.create();
        solarLutRenderer ??= await GpuAtmosphere.create('solar-lut', gpu.device);
        const key = JSON.stringify([solarSignature(s.model), size, s.model.solarSteps]);
        let cached = persistentSolarLuts.get(key), reused = !!cached;
        if (!cached) {
            // Keep at most two solar tables resident in this exploratory demo.
            if (persistentSolarLuts.size >= 2) {
                const oldest = persistentSolarLuts.keys().next().value;
                persistentSolarLuts.get(oldest).lut.dispose(); persistentSolarLuts.delete(oldest);
            }
            const lut = await GpuSolarOpticalLut.create(gpu.device, s.model, { longitude: size[0], latitude: size[1], altitude: size[2], steps: s.model.solarSteps });
            let build;
            try { build = await lut.build((done, total) => { $('status').textContent = `Construction LUT solaire : ${done}/${total} couches...`; }); }
            catch (error) { lut.dispose(); throw error; }
            cached = { lut, build }; persistentSolarLuts.set(key, cached);
        }
        const report = { mode: withVolume ? 'LUT solaire 3D + volume camera GPU' : 'LUT solaire 3D + ray marching de vue GPU', output: [s.width, s.height],
            solarLut: { ...cached.build, reused, note: 'Construction globale hors camera; cout amorti tant que les profils et la declinaison solaire restent fixes.' } };
        const rays = s.rays.map((ray, i) => [...ray, sceneDepth((i % s.width + 0.5) / s.width)]);
        $('status').textContent = 'Chauffe et mesures du rendu direct et de la LUT...'; await yieldUI();
        await gpu.render(s.model, null, s.origin, rays, false);
        await solarLutRenderer.render(s.model, null, s.origin, rays, true, 2000, cached.lut);
        const directRuns = [], lutRuns = [];
        for (let i = 0; i < 3; i++) {
            directRuns.push(await gpu.render(s.model, null, s.origin, rays, false));
            lutRuns.push(await solarLutRenderer.render(s.model, null, s.origin, rays, true, 2000, cached.lut));
        }
        const median = values => { const valid = values.filter(v => v !== null).sort((a, b) => a - b); return valid.length ? valid[Math.floor(valid.length / 2)] : null; };
        const a = directRuns.at(-1), b = lutRuns.at(-1);
        report.directGPU = { runs: directRuns.map(compact), medianGpuMs: median(directRuns.map(r => r.gpuMs)) };
        report.lutGPU = { runs: lutRuns.map(compact), medianGpuMs: median(lutRuns.map(r => r.gpuMs)), error: compare(a.values, b.values) };
        report.warmGpuSpeedup = report.directGPU.medianGpuMs > 0 && report.lutGPU.medianGpuMs > 0 ? report.directGPU.medianGpuMs / report.lutGPU.medianGpuMs : null;
        let displayed = b.values;
        if (withVolume) {
            const n = Number($('volumeSize').value), far = $('sceneDepth').value === 'sky' ? 2000000 : $('sceneDepth').value === 'terrain' ? 10000 : 20000;
            const volume = new FrustumVolume(s.model, null, s.camera, { width: n, height: Math.round(n * 2 / 3), depth: n === 12 ? 48 : 64, far, maxStep: 2000, allocateData: false });
            volumeRenderer = await GpuFrustumVolume.create(gpu.device, solarLutRenderer, cached.lut);
            await volumeRenderer.build(volume); const builds = [], samples = [];
            for (let i = 0; i < 3; i++) { builds.push(await volumeRenderer.build(volume)); samples.push(await volumeRenderer.sample(s.width, s.height, sceneDepth)); }
            displayed = samples.at(-1).values;
            report.hybridGPU = { dimensions: [volume.width, volume.height, volume.depth], builds, reconstruction: samples.map(compact),
                medianBuildGpuMs: median(builds.map(r => r.gpuMs)), error: compare(a.values, displayed), cpuAtmosphereIntegration: false };
        }
        // Validate points across latitudes, heights and the terminator without downloading the 3D texture.
        const points = [], azimuth = Math.atan2(s.model.sun[1], s.model.sun[0]);
        for (const latitude of [-Math.PI / 3, 0, Math.PI / 3]) for (const longitude of [0, 1.2, 1.5, Math.PI / 2, 1.6, 1.8, Math.PI]) for (const h of [100, 1000, 10000, 50000]) points.push(geodeticPosition(s.model.ellipsoid, latitude, azimuth + longitude, h));
        const validation = await cached.lut.validate(points, s.model);
        let squared = 0, maximum = 0, worst = -1, cpuMaximum = 0;
        validation.forEach((value, i) => {
            const cpu = s.model.solarTransmittance(points[i]);
            value.cached.forEach((v, c) => {
                const error = Math.abs(v - value.direct[c]); squared += error * error;
                if (error > maximum) { maximum = error; worst = i; }
                cpuMaximum = Math.max(cpuMaximum, Math.abs(v - cpu[c]));
            });
        });
        report.solarPointValidation = { points: points.length, maxErrorAgainstGPUDirect: maximum, rmseAgainstGPUDirect: Math.sqrt(squared / (3 * points.length)), maxErrorAgainstCPUDirect: cpuMaximum,
            textureHits: validation.reduce((sum, v) => sum + v.hit, 0), directFallbacks: validation.reduce((sum, v) => sum + v.fallback, 0), worstPointECEF: worst < 0 ? null : points[worst] };
        // Check the internal/external pipeline boundary at the configured atmosphere top.
        const transitionRays = [[1, 0, 0], [-1, 0.2, 0], [-0.1, 1, 0]];
        const below = await solarLutRenderer.render(s.model, null, [s.model.ellipsoid.semiMajorAxis + s.model.top - 1, 0, 0], transitionRays, true, 2000, cached.lut);
        const above = await solarLutRenderer.render(s.model, null, [s.model.ellipsoid.semiMajorAxis + s.model.top + 1, 0, 0], transitionRays, true, 2000, cached.lut);
        report.pipelineTransition = { heights: [s.model.top - 1, s.model.top + 1], regimes: [below.viewRegime, above.viewRegime], changeAcrossTwoMeters: compare(below.values, above.values) };
        drawComposite('reference', a.values, s.width, s.height); drawComposite('accelerated', displayed, s.width, s.height); drawError(a.values, displayed, s.width, s.height);
        current.values = { a: a.values, b: displayed, width: s.width, height: s.height, composite: true };
        $('status').textContent = JSON.stringify(report, null, 2); window.atmosphereResult = report;
    } catch (error) { $('status').textContent = String(error.stack || error); }
    finally { volumeRenderer?.dispose(); setBusy(false); }
}
$('solarlut').onclick = () => runSolarLut(false);
$('solarlutvolume').onclick = () => runSolarLut(true);
$('solarlut').disabled = $('solarlutvolume').disabled = !navigator.gpu;

async function getHdSolarLut(model) {
    gpu ??= await GpuAtmosphere.create();
    solarLutRenderer ??= await GpuAtmosphere.create('solar-lut', gpu.device);
    const quality = Number($('solarLutSize').value), size = quality === 128 ? [128, 32, 32] : [256, 64, 48];
    const key = JSON.stringify([solarSignature(model), size, model.solarSteps]);
    const existing = persistentSolarLuts.get(key);
    if (existing) return { ...existing, reused: true };
    if (persistentSolarLuts.size >= 2) {
        const oldest = persistentSolarLuts.keys().next().value;
        persistentSolarLuts.get(oldest).lut.dispose(); persistentSolarLuts.delete(oldest);
    }
    const lut = await GpuSolarOpticalLut.create(gpu.device, model, { longitude: size[0], latitude: size[1], altitude: size[2], steps: model.solarSteps });
    try {
        const build = await lut.build((done, total) => { $('hdStatus').textContent = `Construction LUT solaire : ${done}/${total} couches...`; });
        const result = { lut, build }; persistentSolarLuts.set(key, result); return { ...result, reused: false };
    } catch (error) { lut.dispose(); throw error; }
}
async function renderHD() {
    setBusy(true); $('hdSection').hidden = false;
    hdState?.renderer?.dispose(); hdState = null;
    let renderer;
    try {
        const s = setup(), width = Number($('hdDefinition').value), height = width * 9 / 16;
        let camera = $('hdFov').value === 'scene' ? cameraForDisplay(s.camera,width,height) : cameraWithHorizontalFov(s.camera,width,height,+$('hdFov').value);
        if ($('hdFrameSun').checked && ['ground','dawn','polar'].includes($('view').value)) camera = cameraFramingSun(camera,s.model.sun);
        const solarDisk = projectedSolarDisk(camera,s.model.sun,s.spectral?.solarAngularRadius ?? 0.00465,width,height);
        const framing = { horizontalFovDegrees: 360/Math.PI*Math.atan(camera.halfWidth), verticalFovDegrees:360/Math.PI*Math.atan(camera.halfHeight), solarDisk };
        $('hdStatus').textContent = 'Preparation des ressources GPU...'; await yieldUI();
        const solar = await getHdSolarLut(s.model), quality = Number($('skyLutQuality').value);
        $('hdStatus').textContent = 'Compilation et construction de la Sky-View LUT...'; await yieldUI();
        const setupStart = performance.now();
        renderer = await GpuSkyView.create(gpu.device, $('hdSky'), s.model, camera, solar.lut, { width: quality, hemisphereRows: quality / 4, samples: quality === 256 ? 64 : 32, spectral: s.spectral });
        renderer.resize(width, height); renderer.writeCamera(camera, Number($('exposure').value), $('hdSun').checked);
        const skyBuild = await renderer.build();
        renderer.draw(); await gpu.device.queue.onSubmittedWorkDone();
        const display = [];
        for (let i = 0; i < 3; i++) display.push(await renderer.measureDisplay());
        $('hdStatus').textContent = 'Verification sur des rayons independants de la grille HD...'; await yieldUI();
        const validation = await renderer.validate(solarLutRenderer);
        const validTimes = display.map(v => v.gpuMs).filter(v => v !== null).sort((a, b) => a - b);
        const medianGpuMs = validTimes.length ? validTimes[Math.floor(validTimes.length / 2)] : null;
        const report = { mode: s.spectral ? 'Transport spectral physique + Sky-View HD' : 'Sky-View LUT + presentation WebGPU native', physicalSpectrum: s.spectral?.report ?? null, framing, nativeImage: { width, height, pixels: width * height, canvasWidth: $('hdSky').width, canvasHeight: $('hdSky').height, upscaledLowResolutionImage: false },
            solarLut: { ...solar.build, reused: solar.reused }, skyView: skyBuild, hdDisplay: { measurements: display, medianGpuMs, imageReadback: false, steadyOrientationFramesReuseLuts: true },
            rebuildSkyAndDisplayGpuMs: skyBuild.gpuMs !== null && medianGpuMs !== null ? skyBuild.gpuMs + medianGpuMs : null,
            setupAndValidationWallMs: performance.now() - setupStart, validation,
            note: 'Le temps d affichage seul reutilise la Sky-View LUT. Un changement de position ou de soleil exige sa reconstruction. Validation hors boucle; disque solaire natif et globe uni exclus du comparatif numerique.' };
        hdState = { renderer, report, baseCamera: camera, animation: null };
        $('hdCaption').textContent = `${width} x ${height} pixels calcules sur GPU; Sky-View ${skyBuild.width} x ${skyBuild.height}. Soleil calcule par pixel. Globe uni, sans nuages.${s.spectral ? ' Transport spectral physique, ' + s.spectral.bins.length + ' longueurs d onde. Hypotheses de poussiere experimentales.' : ''}`;
        $('hdCaption').textContent += ` Champ horizontal ${framing.horizontalFovDegrees.toFixed(1)} degres; diametre solaire ${solarDisk ? solarDisk.widthPixels.toFixed(1) + ' pixels natifs (' + solarDisk.angularDiameterDegrees.toFixed(3) + ' degres)' : 'hors champ avant'}.`;
        $('hdStatus').textContent = JSON.stringify(report, null, 2);
        window.atmosphereHDResult = report;
        renderer.draw(camera, Number($('exposure').value), $('hdSun').checked);
    } catch (error) { renderer?.dispose(); $('hdStatus').textContent = String(error.stack || error); }
    finally { setBusy(false); }
}
function stopHdAnimation() {
    if (!hdState?.animation) return;
    cancelAnimationFrame(hdState.animation.request); hdState.animation = null;
    $('animatehd').textContent = 'Animer le regard';
}
function rotateHdCamera(camera, angle) {
    const axis = camera.up, c = Math.cos(angle), s = Math.sin(angle);
    const rotate = vector => {
        const cross = [axis[1] * vector[2] - axis[2] * vector[1], axis[2] * vector[0] - axis[0] * vector[2], axis[0] * vector[1] - axis[1] * vector[0]];
        const dot = axis.reduce((sum, v, i) => sum + v * vector[i], 0);
        return vector.map((v, i) => v * c + cross[i] * s + axis[i] * dot * (1 - c));
    };
    return new FrustumCamera(camera.origin, rotate(camera.forward), rotate(camera.right), camera.up, camera.halfWidth, camera.halfHeight);
}
function animateHD() {
    if (!hdState?.renderer) return;
    if (hdState.animation) { stopHdAnimation(); return; }
    const state = hdState, base = state.renderer.camera, start = performance.now();
    state.animation = { request: 0, frames: 0, lastReport: start, lastFrames: 0 };
    $('animatehd').textContent = 'Pause';
    const frame = timestamp => {
        if (hdState !== state || !state.animation) return;
        try {
            const camera = rotateHdCamera(base, 0.18 * Math.sin((timestamp - start) * 0.0004));
            state.renderer.draw(camera, Number($('exposure').value), $('hdSun').checked); state.animation.frames++;
            if (timestamp - state.animation.lastReport >= 1000) {
                const fps = (state.animation.frames - state.animation.lastFrames) * 1000 / (timestamp - state.animation.lastReport);
                state.report.animation = { requestAnimationFrameFps: fps, imagePixels: state.renderer.width * state.renderer.height, skyViewRebuilds: 0, orientationOnly: true, imageReadback: false };
                $('hdStatus').textContent = JSON.stringify(state.report, null, 2);
                state.animation.lastReport = timestamp; state.animation.lastFrames = state.animation.frames;
            }
            state.animation.request = requestAnimationFrame(frame);
        } catch (error) { stopHdAnimation(); $('hdStatus').textContent = String(error.stack || error); }
    };
    state.animation.request = requestAnimationFrame(frame);
}
$('renderhd').onclick = renderHD;
$('animatehd').onclick = animateHD;
$('fullscreenhd').onclick = () => $('hdSky').requestFullscreen().catch(error => { $('hdStatus').textContent = String(error); });
$('renderhd').disabled = !navigator.gpu;
for (const id of ['exposure', 'hdSun']) $(id).addEventListener('input', () => {
    if (hdState?.renderer && !hdState.animation) hdState.renderer.draw(hdState.renderer.camera, Number($('exposure').value), $('hdSun').checked);
});
for (const id of ['view', 'sun', 'hdDefinition', 'skyLutQuality', 'hdFov', 'hdFrameSun']) $(id).addEventListener('change', stopHdAnimation);

$('savehd').onclick = async () => {
    if (!hdState?.renderer) return;
    setBusy(true);
    try {
        const blob = await hdState.renderer.capturePng(), url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = 'spacexr-sky-full-hd.png'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) { $('hdStatus').textContent = String(error.stack || error); }
    finally { setBusy(false); }
};

$('calibratehd').onclick = async () => {
    if (!hdState?.renderer) return;
    setBusy(true);
    try {
        const renderer = hdState.renderer;
        renderer.writeCamera(hdState.baseCamera, Number($('exposure').value), $('hdSun').checked);
        hdState.report.reuseCalibration = await calibrateSkyReuse(renderer, { onProgress: message => { $('hdStatus').textContent = message; } });
        $('hdStatus').textContent = JSON.stringify(hdState.report, null, 2);
        renderer.draw();
    } catch (error) { $('hdStatus').textContent = String(error.stack || error); }
    finally { setBusy(false); }
};

$('reporthd').onclick = () => {
    if (!hdState?.report) return;
    const blob = new Blob([JSON.stringify(hdState.report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'spacexr-sky-report.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};

$('physicalPreset').onchange = () => {
    stopHdAnimation();
    const p = physicalPresets[$('physicalPreset').value];
    const fields = { physicalPlanet:'planet',pressure:'pressure',gasTemperature:'temperature',gravity:'gravity',dustTau:'dustTau',dustHeight:'dustHeight',dustRadius:'radiusUm',dustSigma:'logSigma',dustN:'indexN',dustK:'indexK',starDistance:'distanceAU' };
    for (const [id,key] of Object.entries(fields)) $(id).value = p[key];
    for (const g of ['N2','O2','CO2','Ar']) $('gas'+g).value = p.mix[g];
    $('view').value = 'ground'; $('physicalAltitude').value = '2'; $('solarElevation').value = '1';
    $('transport').value = 'spectral'; setBusy(false);
};
$('transport').onchange = () => { stopHdAnimation(); setBusy(false); };
for (const input of document.querySelectorAll('fieldset input,fieldset select')) input.addEventListener('change', stopHdAnimation);
setBusy(false);

$('view').addEventListener('change', () => {
    if ($('transport').value !== 'spectral') return;
    const v = $('view').value;
    $('physicalAltitude').value = v === 'orbit' || v === 'limb' ? '400000' : v === 'dawn' ? '60000' : '2';
});
