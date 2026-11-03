import { WGS84, geodeticPosition, normalize } from './src/geometry.js';
import { Atmosphere } from './src/model.js';
import { AtmosphereOctree } from './src/octree.js';
import { integrate } from './src/integrator.js';
import { GpuAtmosphere } from './src/gpu.js';
const $ = id => document.getElementById(id);
let current = null, gpu = null;
const yieldUI = () => new Promise(resolve => setTimeout(resolve, 0));
function setup() {
    const view = $('view').value, sunlight = $('sun').value;
    const key = `${view}/${sunlight}/${$("seams").value}`;
    if (!current || current.key !== key) {
        const sun = sunlight === 'day' ? [1, 1, 0.3] : sunlight === 'sunset' ? [0.02, 1, 0] : [-1, 0, 0];
        const polar = view === 'polar';
        const model = new Atmosphere({ sun: polar ? [sun[2], sun[1], sun[0]] : sun });
        const orbital = view === 'orbit' || view === 'limb';
        current = { key, model, tree: new AtmosphereOctree(model, { seamBlendFraction: Number($("seams").value) }), origin: geodeticPosition(WGS84, polar ? Math.PI / 2 : 0, 0, orbital ? 400000 : 2000), values: null };
    }
    const width = Number($('resolution').value), height = width * 9 / 16, rays = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const u = (2 * (x + 0.5) / width - 1) * 0.7, v = (1 - 2 * (y + 0.5) / height) * 0.45;
        let ray = view === 'orbit' ? [-1, u, v] : view === 'limb' ? [-0.35 + v * 0.25, 1, u * 0.3] : [v + 0.15, 1, u];
        if (view === 'polar') ray = [ray[2], ray[1], ray[0]];
        rays.push(normalize(ray));
    }
    return { ...current, width, height, rays };
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
    $('render').disabled = true; $('gpu').disabled = true;
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
    finally { $('render').disabled = false; $('gpu').disabled = !navigator.gpu; }
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
    for (const id of ['render', 'gpu', 'layouts']) $(id).disabled = true;
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
    finally { devices.forEach(d => d.dispose()); for (const id of ['render', 'gpu', 'layouts']) $(id).disabled = id !== 'render' && !navigator.gpu; }
};


