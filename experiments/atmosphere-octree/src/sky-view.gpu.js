import { spectralSkySources } from './spectral-sky.wgsl.js';
import { spectrumBuffer, phaseTable, integrateSpectral } from './spectrum.js';
import { atmosphereRegime } from './gpu.js';
import { dot } from './geometry.js';
import { makeSkyViewLayout } from './sky-view.js';
import { atmosphereParameters, compileCompute, timedCompute } from './solar-lut.gpu.js';
import { solarGeometrySource } from './solar-lut.wgsl.js';
import { viewStruct, skyMapping, mediumCoordinates, solarAtCoordinates, bakeSkyView, skyReadBindings, skyRadiance, presentSky } from './sky-view.wgsl.js';

export class GpuSkyView {
    static async create(device, canvas, model, camera, solarLut, options = {}) {
        solarLut.assertCompatible(model);
        if (solarLut.device !== device) throw new Error('Solar LUT must belong to the display device');
        const response = await fetch(new URL('./atmosphere.wgsl', import.meta.url));
        if (!response.ok) throw new Error('Cannot load atmosphere equations');
        let geometry = solarGeometrySource(await response.text());
        geometry = geometry.replace(/fn altitude\(p: vec3f\) -> f32 \{[\s\S]*?\nfn density/, 'fn altitude(p: vec3f) -> f32 { return mediumCoordinates(p).z; }\nfn density') + mediumCoordinates;
        const spectral = options.spectral ? spectralSkySources(geometry) : null;
        const buildSource = spectral?.build ?? geometry + solarAtCoordinates + viewStruct + skyMapping + bakeSkyView;
        const [inside, space] = await Promise.all(['main_inside', 'main_space'].map(entry => compileCompute(device, buildSource, entry)));
        const presentationCode = spectral?.presentation ?? geometry + viewStruct + skyMapping + skyReadBindings + skyRadiance + presentSky;
        const module = device.createShaderModule({ code: presentationCode });
        const errors = (await module.getCompilationInfo()).messages.filter(m => m.type === 'error');
        if (errors.length) throw new Error(errors.map(m => `${m.lineNum}: ${m.message}`).join('\n'));
        const format = navigator.gpu.getPreferredCanvasFormat();
        const presentation = await device.createRenderPipelineAsync({ layout: 'auto', vertex: { module, entryPoint: 'vertexMain' }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
        return new GpuSkyView(device, canvas, model, camera, solarLut, options, { inside, space, presentation, geometry, format, probe: spectral?.probe });
    }
    constructor(device, canvas, model, camera, solarLut, options, pipelines) {
        this.spectral = options.spectral; this.groups = this.spectral?.groups ?? 1;
        this.device = device; this.canvas = canvas; this.model = model; this.origin = [...camera.origin]; this.solarLut = solarLut; this.pipelines = pipelines;
        this.layout = makeSkyViewLayout(model, camera.origin, options); this.regime = atmosphereRegime(model, camera.origin);
        this.context = canvas.getContext('webgpu');
        if (!this.context) throw new Error('Cannot create WebGPU canvas');
        this.context.configure({ device, format: pipelines.format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
        this.uniform = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.viewUniform = device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.horizon = device.createBuffer({ size: this.layout.horizon.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.cameraSun = device.createBuffer({ size: 16 * this.groups, usage: GPUBufferUsage.STORAGE });
        device.queue.writeBuffer(this.horizon, 0, this.layout.horizon);
        device.queue.writeBuffer(this.uniform, 0, atmosphereParameters(model, { origin: camera.origin, guardHeight: solarLut.layout.guardHeight }));
        this.textures = Array.from({ length: 3 }, () => device.createTexture({ size: [this.layout.width, this.layout.height, this.groups], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING }));
        this.views = this.textures.map(t => t.createView(this.spectral ? { dimension: '2d-array' } : {}));
        this.spectralResources = [];
        if (this.spectral) {
            const data = spectrumBuffer(this.spectral), phase = phaseTable(this.spectral);
            this.spectrum = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            device.queue.writeBuffer(this.spectrum, 0, data);
            this.phase = device.createTexture({ size: [phase.width, phase.height], format: 'rgba32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
            device.queue.writeTexture({ texture: this.phase }, phase.data, { bytesPerRow: phase.width * 16 }, [phase.width, phase.height]);
            this.spectralResources = [this.spectrum, this.phase];
        }
        this.sampler = device.createSampler({ addressModeU: 'repeat', addressModeV: 'clamp-to-edge', minFilter: 'linear', magFilter: 'linear' });
        this.width = canvas.width; this.height = canvas.height;
        this.exposure = 12; this.sunEnabled = true;
        this.writeCamera(camera);
        const builder = this.regime === 'external' ? pipelines.space : pipelines.inside;
        this.buildEntries = [{ binding: 0, resource: { buffer: this.uniform } }, ...this.views.map((resource, i) => ({ binding: i + 1, resource })),
            { binding: 5, resource: { buffer: this.viewUniform } }, ...solarLut.bindings(), { binding: 8, resource: { buffer: this.horizon } }, { binding: 9, resource: { buffer: this.cameraSun } }];
        if (this.spectral) this.buildEntries.push({ binding: 12, resource: { buffer: this.spectrum } });
        this.builder = builder;
        this.readEntries = [{ binding: 0, resource: { buffer: this.uniform } }, ...this.views.map((resource, i) => ({ binding: i + 1, resource })),
            { binding: 4, resource: this.sampler }, { binding: 5, resource: { buffer: this.viewUniform } }, { binding: 8, resource: { buffer: this.horizon } }];
        if (this.spectral) this.readEntries.push({ binding: 12, resource: { buffer: this.spectrum } }, { binding: 13, resource: this.phase.createView() });
        this.presentGroup = device.createBindGroup({ layout: pipelines.presentation.getBindGroupLayout(0), entries: [...this.readEntries, { binding: 9, resource: { buffer: this.cameraSun } }] });
    }
    viewParameters(camera, basis = this.layout.basis) {
        return new Float32Array([...basis.east, this.layout.width, ...basis.north, this.layout.hemisphereRows, ...basis.up, this.regime === 'external' ? 1 : 0,
            ...camera.forward, 0, ...camera.right, camera.halfWidth, ...camera.up, camera.halfHeight,
            this.width, this.height, this.exposure, this.spectral?.solarAngularRadius ?? 0.00465, this.layout.samples, this.spectral ? 1 / (Math.PI * this.spectral.solarAngularRadius ** 2) : 1000, this.sunEnabled ? 1 : 0, 0,
            0.005, 0.007, 0.01, 1]);
    }
    writeCamera(camera, exposure = this.exposure, sunEnabled = this.sunEnabled) {
        if (camera.origin.some((v, i) => Math.abs(v - this.origin[i]) > 1e-6)) throw new Error('Rebuild Sky-View LUT after camera translation');
        if (!(exposure > 0 && Number.isFinite(exposure))) throw new Error('Invalid exposure');
        this.camera = camera; this.exposure = exposure; this.sunEnabled = sunEnabled;
        this.device.queue.writeBuffer(this.viewUniform, 0, this.viewParameters(camera));
    }
    cloneForCamera(camera) {
        const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
        const clone = new GpuSkyView(this.device, canvas, this.model, camera, this.solarLut,
            { width: this.layout.width, hemisphereRows: this.layout.hemisphereRows, samples: this.layout.samples, spectral: this.spectral }, this.pipelines);
        clone.writeCamera(camera, this.exposure, this.sunEnabled); clone.validationPipeline = this.validationPipeline;
        return clone;
    }
    /** Experimental probe path only: reproject old radiance through new geometric metadata. */
    async sampleAtCamera(rays, camera, lookupLayout) {
        if (lookupLayout.width !== this.layout.width || lookupLayout.height !== this.layout.height) throw new Error('Probe layouts must match');
        const d = this.device;
        d.queue.writeBuffer(this.uniform, 0, atmosphereParameters(this.model, { origin: camera.origin, guardHeight: this.solarLut.layout.guardHeight }));
        d.queue.writeBuffer(this.horizon, 0, lookupLayout.horizon);
        d.queue.writeBuffer(this.viewUniform, 0, this.viewParameters(camera, lookupLayout.basis));
        try { return await this.sampleRays(rays); }
        finally {
            d.queue.writeBuffer(this.uniform, 0, atmosphereParameters(this.model, { origin: this.origin, guardHeight: this.solarLut.layout.guardHeight }));
            d.queue.writeBuffer(this.horizon, 0, this.layout.horizon); this.writeCamera(this.camera);
        }
    }
    resize(width, height) {
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) throw new Error('Invalid display resolution');
        this.width = width; this.height = height; this.canvas.width = width; this.canvas.height = height;
        this.writeCamera(this.camera);
    }
    async build() {
        const start = performance.now();
        const gpuMs = await timedCompute(this.device, this.builder, this.buildEntries, [Math.ceil(this.layout.width / 8), Math.ceil(this.layout.height / 4), this.groups]);
        this.built = true;
        return { gpuMs, ms: performance.now() - start, width: this.layout.width, height: this.layout.height, samples: this.layout.samples, bytes: this.layout.bytes * this.groups, wavelengthGroups: this.groups, regime: this.regime };
    }
    encodeDisplay(encoder, timestampWrites) {
        if (!this.built) throw new Error('Build Sky-View LUT before display');
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }], ...(timestampWrites ? { timestampWrites } : {}) });
        pass.setPipeline(this.pipelines.presentation); pass.setBindGroup(0, this.presentGroup); pass.draw(3); pass.end();
    }
    draw(camera = this.camera, exposure = this.exposure, sunEnabled = this.sunEnabled) {
        this.writeCamera(camera, exposure, sunEnabled);
        const encoder = this.device.createCommandEncoder(); this.encodeDisplay(encoder); this.device.queue.submit([encoder.finish()]);
    }
    async measureDisplay(camera = this.camera) {
        const start = performance.now(), d = this.device, cleanup = []; this.writeCamera(camera);
        const encoder = d.createCommandEncoder(); let queries, readback;
        if (d.features.has('timestamp-query')) { queries = d.createQuerySet({ type: 'timestamp', count: 2 }); cleanup.push(queries); }
        try {
            this.encodeDisplay(encoder, queries ? { querySet: queries, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } : undefined);
            if (queries) {
                const resolved = d.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }); cleanup.push(resolved);
                readback = d.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); cleanup.push(readback);
                encoder.resolveQuerySet(queries, 0, 2, resolved, 0); encoder.copyBufferToBuffer(resolved, 0, readback, 0, 16);
            }
            d.queue.submit([encoder.finish()]); await d.queue.onSubmittedWorkDone();
            let gpuMs = null;
            if (readback) { await readback.mapAsync(GPUMapMode.READ); const data = new BigUint64Array(readback.getMappedRange()); gpuMs = Number(data[1] - data[0]) / 1e6; readback.unmap(); }
            return { gpuMs, ms: performance.now() - start, width: this.width, height: this.height, pixels: this.width * this.height, imageReadback: false };
        } finally { cleanup.forEach(r => r.destroy()); }
    }
    async sampleRays(rays) {
        if (!this.built || !rays.length) throw new Error('Built Sky-View LUT and rays are required');
        const d = this.device, cleanup = [];
        this.validationPipeline ??= await compileCompute(d, this.pipelines.probe ?? this.pipelines.geometry + viewStruct + skyMapping + skyReadBindings + skyRadiance + `
struct Result { radiance: vec4f, transmission: vec4f }
@group(0) @binding(10) var<storage, read> rays: array<vec4f>;
@group(0) @binding(11) var<storage, read_write> result: array<Result>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
    if id.x >= arrayLength(&rays) { return; }
    let d = normalize(rays[id.x].xyz); let hit = intersect(params.origin.xyz, d, 1.0);
    let ground = hit.x >= 0.0 && hit.y >= 0.0;
    let uv = skyCoordinates(d, ground, textureDimensions(rayleighSky));
    result[id.x] = Result(vec4f(reconstructedSky(d, ground), 1.0), textureSampleLevel(transmissionSky, skySampler, uv, 0.0));
}`);
        const upload = data => { const buffer = d.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); d.queue.writeBuffer(buffer, 0, data); cleanup.push(buffer); return buffer; };
        try {
            const input = upload(new Float32Array(rays.flatMap(ray => [...ray, 0])));
            const output = d.createBuffer({ size: rays.length * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }); cleanup.push(output);
            const staging = d.createBuffer({ size: rays.length * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); cleanup.push(staging);
            await timedCompute(d, this.validationPipeline, [...this.readEntries, { binding: 10, resource: { buffer: input } }, { binding: 11, resource: { buffer: output } }], [Math.ceil(rays.length / 64)],
                encoder => encoder.copyBufferToBuffer(output, 0, staging, 0, rays.length * 32));
            await staging.mapAsync(GPUMapMode.READ); const data = new Float32Array(staging.getMappedRange().slice(0)); staging.unmap();
            return rays.map((_, i) => ({ radiance: Array.from(data.slice(i * 8, i * 8 + 3)), transmittance: Array.from(data.slice(i * 8 + 4, i * 8 + 7)) }));
        } finally { cleanup.forEach(resource => resource.destroy()); }
    }
    async validate(referenceRenderer, columns = 24, rows = 14) {
        if (this.spectral) {
            const rays = [];
            for (const v of [0.15, 0.35, 0.48, 0.65, 0.82, 0.95]) for (const u of [0.2, 0.4, 0.5, 0.6, 0.8]) rays.push(this.camera.ray(u, v));
            // Probe the solar forward lobe as well as the broad sky, independently of the grid.
            const sf = dot(this.model.sun,this.camera.forward);
            if (sf > 0) {
                const u = (dot(this.model.sun,this.camera.right)/sf/this.camera.halfWidth+1)/2;
                const v = (1-dot(this.model.sun,this.camera.up)/sf/this.camera.halfHeight)/2;
                for (const offset of [-0.015,-0.005,0,0.005]) if(u>0&&u<1&&v+offset>0&&v+offset<1) rays.push(this.camera.ray(u,v+offset));
            }
            const values = await this.sampleRays(rays);
            const reference = rays.map(ray => integrateSpectral(this.spectral, this.origin, ray));
            let squared = 0, maximum = 0, maximumReference = 0;
            values.forEach((value,i) => value.radiance.forEach((v,c) => { const error = Math.abs(v-reference[i].radiance[c]); squared += error*error; maximum = Math.max(maximum,error); maximumReference = Math.max(maximumReference,Math.abs(reference[i].radiance[c])); }));
            return { probes: rays.length, nonzeroReferenceRays: reference.filter(v => v.radiance.some(c => Math.abs(c) > 1e-10)).length, radianceRMSE: Math.sqrt(squared/(rays.length*3)), maxRadianceError: maximum, referencePeakRadiance: maximumReference,
                reference: 'Independent CPU spectral integration, 256 view steps and 96 direct solar steps. No GPU solar LUT. Disk and neutral ground excluded.',
                raySamples: rays.map((direction,i) => ({direction,cachedRgb:values[i].radiance,referenceRgb:reference[i].radiance})) };
        }
        const rays = [];
        for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) rays.push(this.camera.ray((x + 0.5) / columns, (y + 0.5) / rows));
        const values = await this.sampleRays(rays);
        const reference = await referenceRenderer.render(this.model, null, this.origin, rays, true, 1000, this.solarLut);
        let squared = 0, maxRadianceError = 0, maxTransmittanceError = 0;
        values.forEach((value, i) => value.radiance.forEach((v, c) => {
            const error = Math.abs(v - reference.values[i].radiance[c]); squared += error * error; maxRadianceError = Math.max(maxRadianceError, error);
            maxTransmittanceError = Math.max(maxTransmittanceError, Math.abs(value.transmittance[c] - reference.values[i].transmittance[c]));
        }));
        return { probes: rays.length, radianceRMSE: Math.sqrt(squared / (rays.length * 3)), maxRadianceError, maxTransmittanceError,
            reference: 'GPU ray marching, 1 km maximum step, same solar LUT; excludes disk and ground base color' };
    }
    /** Explicit PNG export only; normal display never reads image pixels back to CPU. */
    async capturePng() {
        const d = this.device, width = this.width, height = this.height;
        const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
        const staging = d.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        try {
            const encoder = d.createCommandEncoder(); this.encodeDisplay(encoder);
            encoder.copyTextureToBuffer({ texture: this.context.getCurrentTexture() }, { buffer: staging, bytesPerRow, rowsPerImage: height }, [width, height]);
            d.queue.submit([encoder.finish()]); await staging.mapAsync(GPUMapMode.READ);
            const source = new Uint8Array(staging.getMappedRange()), pixels = new Uint8ClampedArray(width * height * 4);
            const bgra = this.pipelines.format.startsWith('bgra');
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                const from = y * bytesPerRow + x * 4, to = (y * width + x) * 4;
                pixels[to] = source[from + (bgra ? 2 : 0)]; pixels[to + 1] = source[from + 1];
                pixels[to + 2] = source[from + (bgra ? 0 : 2)]; pixels[to + 3] = 255;
            }
            staging.unmap();
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
            return canvas.convertToBlob({ type: 'image/png' });
        } finally { staging.destroy(); }
    }
    dispose() {
        this.spectralResources.forEach(r => r.destroy()); this.textures.forEach(t => t.destroy()); this.uniform.destroy(); this.viewUniform.destroy(); this.horizon.destroy(); this.cameraSun.destroy(); this.context.unconfigure(); this.built = false;
    }
}
