import { SolarOpticalLut } from './solar-lut.js';
import { solarGeometrySource, solarLutBake, solarLutSampling } from './solar-lut.wgsl.js';
export async function compileCompute(device, code) {
    const module = device.createShaderModule({ code });
    const errors = (await module.getCompilationInfo()).messages.filter(m => m.type === 'error');
    if (errors.length) throw new Error(errors.map(m => `${m.lineNum}: ${m.message}`).join('\n'));
    return device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
}
export function atmosphereParameters(model, { origin = [0, 0, 0], count = 0, maxStep = 2000, mode = 0, canonicalSun = false, steps = model.solarSteps, guardHeight = 20000 } = {}) {
    const sun = canonicalSun ? [Math.sqrt(Math.max(0, 1 - model.sun[2] ** 2)), 0, model.sun[2]] : model.sun;
    return new Float32Array([...origin.map(v => v / 1000), 0, ...sun, 0,
        model.ellipsoid.semiMajorAxis / 1000, model.ellipsoid.semiMinorAxis / 1000, model.top / 1000, 0,
        ...model.rayleigh.map(v => v * 1000), guardHeight / 1000, model.mieScattering * 1000, model.mieExtinction * 1000,
        model.rayleighHeight / 1000, model.mieHeight / 1000, maxStep / 1000, steps, count, mode]);
}
export async function timedCompute(device, pipeline, entries, groups, after = () => {}) {
    const encoder = device.createCommandEncoder(), cleanup = [];
    let query, staging; const descriptor = {};
    if (device.features.has('timestamp-query')) {
        query = device.createQuerySet({ type: 'timestamp', count: 2 }); cleanup.push(query);
        descriptor.timestampWrites = { querySet: query, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
    }
    try {
        const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
        const pass = encoder.beginComputePass(descriptor);
        pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(...groups); pass.end(); after(encoder);
        if (query) {
            const resolved = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }); cleanup.push(resolved);
            staging = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); cleanup.push(staging);
            encoder.resolveQuerySet(query, 0, 2, resolved, 0); encoder.copyBufferToBuffer(resolved, 0, staging, 0, 16);
        }
        device.queue.submit([encoder.finish()]); await device.queue.onSubmittedWorkDone();
        if (!staging) return null;
        await staging.mapAsync(GPUMapMode.READ); const stamps = new BigUint64Array(staging.getMappedRange());
        const ms = Number(stamps[1] - stamps[0]) / 1e6; staging.unmap(); return ms;
    } finally { cleanup.forEach(r => r.destroy()); }
}
export class GpuSolarOpticalLut {
    static async create(device, model, options = {}) {
        const response = await fetch(new URL('./atmosphere.wgsl', import.meta.url));
        if (!response.ok) throw new Error('Cannot load atmospheric shader');
        const geometry = solarGeometrySource(await response.text());
        const pipeline = await compileCompute(device, geometry + solarLutBake);
        return new GpuSolarOpticalLut(device, model, options, pipeline, geometry);
    }
    constructor(device, model, options, pipeline, geometry) {
        this.device = device; this.layout = new SolarOpticalLut(model, options); this.pipeline = pipeline; this.geometry = geometry;
        this.texture = device.createTexture({ dimension: '3d', size: this.layout.size, format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
        this.sampler = device.createSampler({ addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge', minFilter: 'linear', magFilter: 'linear' });
        this.uniform = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.built = false;
    }
    assertCompatible(model) { if (!this.built) throw new Error('Build GPU solar LUT before use'); this.layout.assertCompatible(model); }
    bindings(textureBinding = 6, samplerBinding = 7) {
        return [{ binding: textureBinding, resource: this.texture.createView() }, { binding: samplerBinding, resource: this.sampler }];
    }
    async build(onProgress = () => {}) {
        const start = performance.now(), m = this.layout.model, batch = 8; let gpuMs = 0;
        for (let z = 0; z < this.layout.size[2]; z += batch) {
            this.device.queue.writeBuffer(this.uniform, 0, atmosphereParameters(m, { canonicalSun: true, steps: this.layout.steps, count: z }));
            const elapsed = await timedCompute(this.device, this.pipeline, [{ binding: 0, resource: { buffer: this.uniform } }, { binding: 1, resource: this.texture.createView() }],
                [Math.ceil(this.layout.size[0] / 8), Math.ceil(this.layout.size[1] / 4), Math.min(batch, this.layout.size[2] - z)]);
            if (elapsed === null) gpuMs = null; else if (gpuMs !== null) gpuMs += elapsed;
            onProgress(Math.min(z + batch, this.layout.size[2]), this.layout.size[2]);
        }
        this.built = true;
        return { ms: performance.now() - start, gpuMs, size: this.layout.size, bytes: this.layout.bytes, solarSteps: this.layout.steps };
    }
    async validate(points, model = this.layout.model) {
        this.assertCompatible(model); const d = this.device, cleanup = [];
        this.validationPipeline ??= await compileCompute(d, this.geometry + solarLutSampling + `
struct Result { cached: vec4f, direct: vec4f }
@group(0) @binding(1) var<storage, read> points: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> results: array<Result>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if id.x >= arrayLength(&points) { return; }
    let cached = lutSolar(points[id.x].xyz); let fallbacks = directCalls;
    let direct = directSolar(points[id.x].xyz);
    results[id.x] = Result(vec4f(cached, f32(cacheHits)), vec4f(direct, f32(fallbacks)));
}`);
        const upload = (data, usage) => { const buffer = d.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST }); d.queue.writeBuffer(buffer, 0, data); cleanup.push(buffer); return buffer; };
        try {
            const uniform = upload(atmosphereParameters(model, { guardHeight: this.layout.guardHeight }), GPUBufferUsage.UNIFORM);
            const input = upload(new Float32Array(points.flatMap(p => [...p.map(v => v / 1000), 0])), GPUBufferUsage.STORAGE);
            const output = d.createBuffer({ size: points.length * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }); cleanup.push(output);
            const staging = d.createBuffer({ size: points.length * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); cleanup.push(staging);
            await timedCompute(d, this.validationPipeline, [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: { buffer: input } }, { binding: 3, resource: { buffer: output } }, ...this.bindings()],
                [Math.ceil(points.length / 64)], encoder => encoder.copyBufferToBuffer(output, 0, staging, 0, points.length * 32));
            await staging.mapAsync(GPUMapMode.READ); const values = new Float32Array(staging.getMappedRange().slice(0)); staging.unmap();
            return points.map((_, i) => ({ cached: Array.from(values.slice(i * 8, i * 8 + 3)), direct: Array.from(values.slice(i * 8 + 4, i * 8 + 7)), hit: values[i * 8 + 3], fallback: values[i * 8 + 7] }));
        } finally { cleanup.forEach(r => r.destroy()); }
    }
    dispose() { this.texture.destroy(); this.uniform.destroy(); this.built = false; }
}
