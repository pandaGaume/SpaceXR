import { gridWgsl } from './grid.wgsl.js';
import { toFloat16 } from './grid.js';
/** Linearized octree ABI: 192 bytes per node, indices 0 denote absent children. */
export function packOctree(tree) {
    tree.assertValid();
    const cells = [], indices = new Map();
    const visit = cell => { indices.set(cell, cells.length); cells.push(cell); for (const child of cell.children) if (child) visit(child); };
    visit(tree.root);
    const data = new ArrayBuffer(cells.length * 192), f = new Float32Array(data), u = new Uint32Array(data);
    cells.forEach((cell, index) => {
        const offset = index * 48;
        f.set([...cell.center.map(x => x / 1000), cell.half / 1000], offset);
        cell.children.forEach((child, j) => { if (child) u[offset + 4 + j] = indices.get(child); });
        if (cell.corners && !cell.corners.some(c => c.every(v => v === 0))) {
            u[offset + 12] = 1;
            cell.corners.forEach((value, j) => f.set([...value, 0], offset + 16 + j * 4));
        }
    });
    return data;
}
/** Optional compute path. CPU builds the cache; GPU reads it and falls back to direct solar integration.
 * Readback is intentional for numerical comparison. This is not a Babylon render pass.
 */
export class GpuAtmosphere {
    static async create(layout = 'octree') {
        if (!navigator.gpu) throw new Error('WebGPU unavailable; CPU demo remains available');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('No WebGPU adapter');
        const hasTimestamps = adapter.features.has('timestamp-query');
        const device = await adapter.requestDevice({ requiredFeatures: hasTimestamps ? ['timestamp-query'] : [] });
        const response = await fetch(new URL('./atmosphere.wgsl', import.meta.url));
        if (!response.ok) throw new Error('Cannot load atmosphere.wgsl');
        let code = await response.text();
        if (layout !== 'octree') code = gridWgsl(layout) + code.replace('if params.settings.w < 0.5', 'if params.settings.w > 1.5 { return gridSolar(p); } if params.settings.w < 0.5');
        const module = device.createShaderModule({ code });
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter(m => m.type === 'error');
        if (errors.length) { device.destroy(); throw new Error(errors.map(m => `${m.lineNum}: ${m.message}`).join('\n')); }
        const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
        return new GpuAtmosphere(device, pipeline, layout);
    }
    constructor(device, pipeline, layout) { this.device = device; this.pipeline = pipeline; this.layout = layout; }
    async render(model, tree, origin, rays, useCache = true, maxStep = 2000, grid = null) {
        const start = performance.now(), d = this.device, resources = [];
        const upload = (data, usage) => {
            const buffer = d.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
            d.queue.writeBuffer(buffer, 0, data); resources.push(buffer); return buffer;
        };
        try {
            const parameters = new Float32Array([
                ...origin.map(x => x / 1000), tree.options.seamBlendFraction, ...model.sun, 0,
                model.ellipsoid.semiMajorAxis / 1000, model.ellipsoid.semiMinorAxis / 1000, model.top / 1000, 0,
                ...model.rayleigh.map(x => x * 1000), 0,
                model.mieScattering * 1000, model.mieExtinction * 1000, model.rayleighHeight / 1000, model.mieHeight / 1000,
                maxStep / 1000, model.solarSteps, rays.length, useCache ? (this.layout === 'octree' ? 1 : 2) : 0
            ]);
            const uniforms = upload(parameters, GPUBufferUsage.UNIFORM);
            const directions = upload(new Float32Array(rays.flatMap(r => [...r, 0])), GPUBufferUsage.STORAGE);
            const nodes = upload(packOctree(tree), GPUBufferUsage.STORAGE);
            const output = d.createBuffer({ size: rays.length * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }); resources.push(output);
            const staging = d.createBuffer({ size: rays.length * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); resources.push(staging);
            const entries = [uniforms, directions, nodes, output].map((buffer, binding) => ({ binding, resource: { buffer } }));
            if (this.layout !== 'octree') {
                if (!grid) throw new Error('Grid required for this layout');
                const n = grid.dimension, params = new ArrayBuffer(48), floats = new Float32Array(params), ints = new Uint32Array(params);
                floats.set(grid.min.map(x => x / 1000), 0); floats.set(grid.step.map(x => x / 1000), 4); ints[8] = n;
                entries.push({ binding: 4, resource: { buffer: upload(params, GPUBufferUsage.UNIFORM) } }, { binding: 5, resource: { buffer: upload(grid.flags, GPUBufferUsage.STORAGE) } });
                if (this.layout === 'buffer') entries.push({ binding: 6, resource: { buffer: upload(grid.data, GPUBufferUsage.STORAGE) } });
                else {
                    const is3D = this.layout === 'texture3d', size = is3D ? [n, n, n] : [n * n, n, 1];
                    const texture = d.createTexture({ dimension: is3D ? '3d' : '2d', size, format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }); resources.push(texture);
                    let texels = toFloat16(grid.data);
                    if (!is3D) {
                        const atlas = new Uint16Array(texels.length);
                        for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                            const source = (x + n * (y + n * z)) * 4, target = (z * n + x + n * n * y) * 4;
                            atlas.set(texels.subarray(source, source + 4), target);
                        }
                        texels = atlas;
                    }
                    d.queue.writeTexture({ texture }, texels, { bytesPerRow: size[0] * 8, rowsPerImage: n }, size);
                    entries.push({ binding: 6, resource: texture.createView() }, { binding: 7, resource: d.createSampler({ magFilter: 'linear', minFilter: 'linear' }) });
                }
            }
            const group = d.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries });
            const encoder = d.createCommandEncoder();
            let queries, queryReadback;
            const descriptor = {};
            if (d.features.has('timestamp-query')) {
                queries = d.createQuerySet({ type: 'timestamp', count: 2 }); resources.push(queries);
                descriptor.timestampWrites = { querySet: queries, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
            }
            const pass = encoder.beginComputePass(descriptor);
            pass.setPipeline(this.pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(rays.length / 64)); pass.end();
            encoder.copyBufferToBuffer(output, 0, staging, 0, rays.length * 32);
            if (queries) {
                const resolved = d.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }); resources.push(resolved);
                queryReadback = d.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); resources.push(queryReadback);
                encoder.resolveQuerySet(queries, 0, 2, resolved, 0); encoder.copyBufferToBuffer(resolved, 0, queryReadback, 0, 16);
            }
            d.queue.submit([encoder.finish()]);
            await staging.mapAsync(GPUMapMode.READ);
            const result = new Float32Array(staging.getMappedRange().slice(0)); staging.unmap();
            let gpuMs = null;
            if (queryReadback) {
                await queryReadback.mapAsync(GPUMapMode.READ);
                const timestamps = new BigUint64Array(queryReadback.getMappedRange());
                gpuMs = Number(timestamps[1] - timestamps[0]) / 1e6; queryReadback.unmap();
            }
            const cacheHits = rays.reduce((sum, _, i) => sum + result[i * 8 + 3], 0), directCalls = rays.reduce((sum, _, i) => sum + result[i * 8 + 7], 0);
            return { gpuMs, cacheHits, directCalls, layout: this.layout, values: rays.map((_, i) => ({ radiance: Array.from(result.slice(i * 8, i * 8 + 3)), transmittance: Array.from(result.slice(i * 8 + 4, i * 8 + 7)) })), ms: performance.now() - start };
        } finally { resources.forEach(buffer => buffer.destroy()); }
    }
    dispose() { this.device.destroy(); }
}



