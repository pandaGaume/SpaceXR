import { packOctree } from './gpu.js';
import { dot } from './geometry.js';

const buildMain = `
@group(0) @binding(3) var<storage, read> sliceDepths: array<f32>;
@group(0) @binding(4) var lightVolume: texture_storage_3d<rgba16float, write>;
@group(0) @binding(5) var transmissionVolume: texture_storage_3d<rgba16float, write>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if id.x >= u32(params.settings.z) { return; }
    let o = params.origin.xyz; let d = normalize(rays[id.x].xyz);
    let hit = intersect(o, d, 1.0 + params.axesTop.z / params.axesTop.y);
    let start = max(0.0, hit.x); var end = hit.y;
    let ground = intersect(o, d, 1.0);
    if ground.y >= start && ground.x >= start { end = min(end, ground.x); }
    var light = vec3f(0.0); var transmission = vec3f(1.0);
    let mu = dot(d, params.sun.xyz); let g = 0.8;
    let phaseR = 3.0 * (1.0 + mu * mu) / (16.0 * PI);
    let phaseM = 3.0 * (1.0 - g * g) * (1.0 + mu * mu) / (8.0 * PI * (2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
    var t = start;
    let size = textureDimensions(lightVolume);
    for (var z = 0u; z < size.z; z++) {
        let stop = min(end, sliceDepths[z] / rays[id.x].w);
        loop {
            if t >= stop { break; }
            let ds = min(params.settings.x, stop - t);
            let p = o + d * (t + 0.5 * ds); let rho = density(p);
            if any(rho > vec2f(0.0)) {
                let ext = extinction(rho); let stepT = exp(-ext * ds);
                let source = solar(p) * (params.rayleigh.xyz * rho.x * phaseR + vec3f(params.mie.x * rho.y * phaseM));
                var weight = vec3f(ds);
                for (var c = 0u; c < 3u; c++) { if ext[c] > 1e-7 { weight[c] = (1.0 - stepT[c]) / ext[c]; } }
                light += transmission * source * weight; transmission *= stepT;
            }
            t += ds;
        }
        let coord = vec3i(i32(id.x % size.x), i32(id.x / size.x), i32(z));
        textureStore(lightVolume, coord, vec4f(light, 1.0));
        textureStore(transmissionVolume, coord, vec4f(transmission, 1.0));
    }
}
`;
const sampleCode = `
struct Result { radiance: vec4f, transmission: vec4f }
@group(0) @binding(0) var light: texture_3d<f32>;
@group(0) @binding(1) var transmission: texture_3d<f32>;
@group(0) @binding(2) var linearSampler: sampler;
@group(0) @binding(3) var<storage, read> queries: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> results: array<Result>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if id.x >= arrayLength(&queries) { return; }
    let query = queries[id.x];
    if query.w < 0.0 { return; }
    results[id.x] = Result(textureSampleLevel(light, linearSampler, query.xyz, 0.0), textureSampleLevel(transmission, linearSampler, query.xyz, 0.0));
}
`;
/** GPU volume construction and texture3D reconstruction. Uses an already prepared CPU solar octree. */
export class GpuFrustumVolume {
    static async create(device, fallbackRenderer = null) {
        const response = await fetch(new URL('./atmosphere.wgsl', import.meta.url));
        if (!response.ok) throw new Error('Cannot load atmospheric shader');
        const source = (await response.text()).split('@compute @workgroup_size(64)')[0]
            .replace('@group(0) @binding(3) var<storage, read_write> results: array<Result>;', '') + buildMain;
        const compile = async code => {
            const module = device.createShaderModule({ code });
            const errors = (await module.getCompilationInfo()).messages.filter(m => m.type === 'error');
            if (errors.length) throw new Error(errors.map(m => `${m.lineNum}: ${m.message}`).join('\n'));
            return device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
        };
        return new GpuFrustumVolume(device, await compile(source), await compile(sampleCode), fallbackRenderer);
    }
    constructor(device, builder, sampler, fallbackRenderer) { this.fallbackRenderer = fallbackRenderer; this.device = device; this.builder = builder; this.sampler = sampler; this.textures = []; }
    upload(data, usage, resources) {
        const buffer = this.device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(buffer, 0, data); resources.push(buffer); return buffer;
    }
    async dispatch(pipeline, entries, count, after = () => {}) {
        const d = this.device, encoder = d.createCommandEncoder(), cleanup = [];
        let query, mapped; const descriptor = {};
        if (d.features.has('timestamp-query')) {
            query = d.createQuerySet({ type: 'timestamp', count: 2 }); cleanup.push(query);
            descriptor.timestampWrites = { querySet: query, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
        }
        const group = d.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
        const pass = encoder.beginComputePass(descriptor);
        pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end(); after(encoder);
        if (query) {
            const resolve = d.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }); cleanup.push(resolve);
            mapped = d.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); cleanup.push(mapped);
            encoder.resolveQuerySet(query, 0, 2, resolve, 0); encoder.copyBufferToBuffer(resolve, 0, mapped, 0, 16);
        }
        try {
            d.queue.submit([encoder.finish()]); await d.queue.onSubmittedWorkDone();
            if (!mapped) return null;
            await mapped.mapAsync(GPUMapMode.READ); const stamps = new BigUint64Array(mapped.getMappedRange());
            const ms = Number(stamps[1] - stamps[0]) / 1e6; mapped.unmap(); return ms;
        } finally { cleanup.forEach(r => r.destroy()); }
    }
    async build(volume) {
        const start = performance.now(), d = this.device, resources = [], m = volume.model;
        if (!volume.tree) throw new Error('Hybrid GPU requires a solar tree');
        this.textures.forEach(t => t.destroy()); this.textures = [];
        try {
            for (let i = 0; i < 2; i++) this.textures.push(d.createTexture({ dimension: '3d', size: [volume.width, volume.height, volume.depth], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING }));
            const parameters = new Float32Array([
                ...volume.camera.origin.map(v => v / 1000), volume.tree.options.seamBlendFraction, ...m.sun, 0,
                m.ellipsoid.semiMajorAxis / 1000, m.ellipsoid.semiMinorAxis / 1000, m.top / 1000, 0, ...m.rayleigh.map(v => v * 1000), 0,
                m.mieScattering * 1000, m.mieExtinction * 1000, m.rayleighHeight / 1000, m.mieHeight / 1000,
                volume.maxStep / 1000, m.solarSteps, volume.rays.length, 1
            ]);
            const buffers = [this.upload(parameters, GPUBufferUsage.UNIFORM, resources),
                this.upload(new Float32Array(volume.rays.flatMap(ray => [...ray, dot(ray, volume.camera.forward)])), GPUBufferUsage.STORAGE, resources),
                this.upload(packOctree(volume.tree), GPUBufferUsage.STORAGE, resources),
                this.upload(new Float32Array(volume.depths.map(v => v / 1000)), GPUBufferUsage.STORAGE, resources)];
            const entries = buffers.map((buffer, binding) => ({ binding, resource: { buffer } }));
            this.textures.forEach((texture, i) => entries.push({ binding: 4 + i, resource: texture.createView() }));
            const gpuMs = await this.dispatch(this.builder, entries, volume.rays.length);
            this.volume = volume; return { ms: performance.now() - start, gpuMs, textureBytes: volume.width * volume.height * volume.depth * 16 };
        } finally { resources.forEach(r => r.destroy()); }
    }
    async sample(width, height, maxDistance = Infinity) {
        const start = performance.now(), d = this.device, v = this.volume, resources = [], queries = [], initial = [], count = width * height;
        if (!v) throw new Error('Build GPU volume before sampling');
        let fallbacks = 0; const fallbackQueries = [], fallbackIndices = [];
        try {
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                const u = (x + 0.5) / width, w = (y + 0.5) / height;
                const depth = typeof maxDistance === 'function' ? maxDistance(u, w) : maxDistance;
                const target = v.target(u, w, depth), valid = v.lookup(u, w, target.depth);
                if (!valid) {
                                        if (this.fallbackRenderer) {
                        initial.push(0, 0, 0, 1, 1, 1, 1, 1); fallbackQueries.push([...target.ray, depth]); fallbackIndices.push(initial.length / 8 - 1);
                    } else {
                        const result = v.sample(u, w, depth); initial.push(...result.radiance, 1, ...result.transmittance, 1);
                    }
                    queries.push(0, 0, 0, -1); fallbacks++; continue;
                }
                let z = 0; while (z < v.depth - 2 && v.depths[z + 1] < target.depth) z++;
                const fraction = (target.depth - v.depths[z]) / (v.depths[z + 1] - v.depths[z]);
                queries.push((u * (v.width - 1) + 0.5) / v.width, (w * (v.height - 1) + 0.5) / v.height, (z + fraction + 0.5) / v.depth, 1);
                initial.push(0, 0, 0, 1, 1, 1, 1, 1);
            }
            const queryBuffer = this.upload(new Float32Array(queries), GPUBufferUsage.STORAGE, resources);
            const output = this.upload(new Float32Array(initial), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, resources);
            const staging = d.createBuffer({ size: count * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); resources.push(staging);
            const entries = [{ binding: 0, resource: this.textures[0].createView() }, { binding: 1, resource: this.textures[1].createView() },
                { binding: 2, resource: d.createSampler({ magFilter: 'linear', minFilter: 'linear' }) }, { binding: 3, resource: { buffer: queryBuffer } }, { binding: 4, resource: { buffer: output } }];
            const gpuMs = await this.dispatch(this.sampler, entries, count, encoder => encoder.copyBufferToBuffer(output, 0, staging, 0, count * 32));
            await staging.mapAsync(GPUMapMode.READ); const data = new Float32Array(staging.getMappedRange().slice(0)); staging.unmap();
                        const values = Array.from({ length: count }, (_, i) => ({ radiance: Array.from(data.slice(i * 8, i * 8 + 3)), transmittance: Array.from(data.slice(i * 8 + 4, i * 8 + 7)) }));
            let fallbackGpuMs = 0;
            if (fallbackQueries.length) {
                const fallback = await this.fallbackRenderer.render(v.model, v.tree, v.camera.origin, fallbackQueries, true, v.maxStep);
                fallbackGpuMs = fallback.gpuMs;
                fallbackIndices.forEach((index, i) => { values[index] = fallback.values[i]; });
            }
            return { ms: performance.now() - start, gpuMs, fallbackGpuMs, fallbackPath: this.fallbackRenderer ? 'GPU' : 'CPU', fallbacks, values };
        } finally { resources.forEach(r => r.destroy()); }
    }
    dispose() { this.textures.forEach(t => t.destroy()); this.textures = []; this.volume = null; }
}
