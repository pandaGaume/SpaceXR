from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/packages/babylon-earth')
f=root/'src/atmosphere/babylon-sky.ts';s=f.read_text(encoding='utf-8')
s=s.replace('import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture.js";','import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";')
s=s.replace('import type { IAtmosphere }','import { makeSpectralScene } from "@spacexr/atmosphere";\nimport type { IAtmosphere }')
s=s.replace('    quality?: IAtmosphereSkyOptions;','''    quality?: IAtmosphereSkyOptions;
    /** Bounded per-frame moving-view quality. Solar and spectral settings stay shared with quality. */
    motionQuality?: Pick<IAtmosphereSkyOptions, "width" | "hemisphereRows" | "viewSteps">;''')
s=s.replace('Default 8.','Default 2.').replace('private texture: BaseTexture','private texture: Texture')
s=s.replace('    private baking = false;\n    private construction: IAtmosphereCamera | undefined;\n    private baked: IAtmosphereCamera | undefined;', '''    private motionBaked: IAtmosphereCamera | undefined;
    private settledBaked: IAtmosphereCamera | undefined;
    private settledBuilding: IAtmosphereCamera | undefined;
    private lastMotionAt = 0;
    private lastPose: IAtmosphereCamera | undefined;
    private motionReady = false;
    private pending: Promise<void> | undefined;''')
s=s.replace('private readonly sky: AtmosphereSky,','private readonly motionSky: AtmosphereSky,\n        private readonly settledSky: AtmosphereSky,\n        private readonly model: IAtmosphere,')
s=s.replace('    private exposure: number;','    private exposure: number;\n    private readonly solarAngularRadius: number;')
s=s.replace('this.exposure = options.exposure ?? 12;','this.exposure = options.exposure ?? 12;\n        this.solarAngularRadius = makeSpectralScene(model, options.quality).solarAngularRadius;')
s=s.replace('size: 64,','size: 80,')
s=s.replace('dispatches = options.dispatchesPerFrame ?? 8;','dispatches = options.dispatchesPerFrame ?? 2;')
start=s.index('        const sky = await AtmosphereSky.create(');end=s.index('    public setEnabled',start)
s=s[:start]+'''        const quality = { width: 64, hemisphereRows: 32, viewSteps: 64, solarSteps: 48, ...options.quality };
        const motion = await AtmosphereSky.create(device, model, {
            ...quality, width: 16, hemisphereRows: 8, viewSteps: 16, ...options.motionQuality,
        });
        let settled: AtmosphereSky | undefined;
        try {
            settled = await AtmosphereSky.create(device, model, quality);
            return new BabylonEarthSky(scene, engine, device, motion, settled, model, options);
        } catch (error) { motion.dispose(); settled?.dispose(); throw error; }
    }
'''+s[end:]
start=s.index('    /** Called before Babylon begins');end=s.index('    private async compile',start)
s=s[:start]+'''    /** Completes one exact-position moving cache before drawing; refines a separate cache only at rest. */
    public async update(camera: Camera): Promise<void> {
        if (this.disposed) throw new Error("Earth atmosphere is disposed.");
        if (this.failure) throw this.failure;
        if (!this.enabled) return;
        // Do not let asynchronous GPU submissions accumulate behind user input.
        await this.pending;
        if (this.disposed) return;
        const width = this.options.width ?? 768;
        const height = Math.max(1, Math.round(width * this.engine.getRenderHeight() / this.engine.getRenderWidth()));
        const current = atmosphereCamera(camera, width, height);
        const samePosition = (a: IAtmosphereCamera | undefined) => a !== undefined &&
            Math.hypot(...current.positionEcefMeters.map((v,i)=>v-a.positionEcefMeters[i]!)) < 0.001;
        if (!samePosition(this.lastPose)) { this.lastMotionAt = performance.now(); this.lastPose = current; }
        const encoder = this.device.createCommandEncoder({label:"Earth sky, current camera"});
        if (!samePosition(this.motionBaked)) this.motionSky.update(current);
        if (this.motionSky.encode(encoder, this.motionReady ? 4096 : (this.options.dispatchesPerFrame ?? 2))) {
            this.motionReady = true; this.motionBaked = current;
        }
        let active = this.motionReady ? this.motionSky : undefined;
        if (this.motionReady && performance.now() - this.lastMotionAt >= 250) {
            if (!samePosition(this.settledBaked)) {
                if (!samePosition(this.settledBuilding)) { this.settledSky.update(current); this.settledBuilding = current; }
                if (this.settledSky.encode(encoder, this.options.dispatchesPerFrame ?? 2)) this.settledBaked = current;
            }
            if (samePosition(this.settledBaked)) active = this.settledSky;
        }
        if (active) {
            if (!this.pipeline && !this.compiling) this.compiling = this.compile(active).catch(error=>{this.failure=error;});
            if (this.pipeline) {
                this.resize(width,height);
                this.device.queue.writeBuffer(this.uniform,0,new Float32Array([
                    ...current.forwardEcef,0,...current.rightEcef,current.halfWidthTangent,
                    ...current.upEcef,current.halfHeightTangent,width,height,this.exposure,0,
                    ...this.model.sun,this.solarAngularRadius,
                ]));
                const pass=encoder.beginRenderPass({colorAttachments:[{view:this.output!.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});
                pass.setPipeline(this.pipeline);pass.setBindGroup(0,active.bindings().group);pass.setBindGroup(1,this.group!);pass.draw(3);pass.end();
                this.ready=true;this.layer.isEnabled=true;
            }
        }
        this.device.queue.submit([encoder.finish()]);
        this.pending=this.device.queue.onSubmittedWorkDone().catch(error=>{this.failure=error;});
    }
'''+s[end:]
s=s.replace('private async compile(): Promise<void> {\n        const layout = this.sky.bindings().layout;','private async compile(sky: AtmosphereSky): Promise<void> {\n        const layout = sky.bindings().layout;')
s=s.replace('this.texture = new BaseTexture(this.scene, internal);','''this.texture = new Texture(null, this.scene, {internalTexture:internal, noMipmap:true, samplingMode:2, invertY:false});
        // WebGPU render-target rows run top to bottom; Babylon Layer UVs run bottom to top.
        this.texture.vScale = -1; this.texture.vOffset = 1;''')
s=s.replace('this.sky.dispose();','this.motionSky.dispose();\n        this.settledSky.dispose();')
f.write_text(s,encoding='utf-8',newline='\n')
f=root/'src/earth-runtime.ts';s=f.read_text(encoding='utf-8').replace('sky?.update(camera!);','await sky?.update(camera!);');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'src/atmosphere/display.wgsl';s=f.read_text(encoding='utf-8').replace('up: vec4f, screen: vec4f }','up: vec4f, screen: vec4f, sun: vec4f }')
s=s.replace('    let radiance = max(vec3f(0.0), atmosphere_skyRadiance(direction));','''    var radiance = max(vec3f(0.0), atmosphere_skyRadiance(direction));
    // Direct stellar disc, using the same spectral irradiance and path transmission as the sky.
    let mu = dot(direction,displayCamera.sun.xyz);
    let edge = cos(displayCamera.sun.w);
    let aa = max(fwidth(mu),1e-8);
    let disc = smoothstep(edge-aa,edge+aa,mu);
    let ground = atmosphere_intersect(atmosphere_cameraPoint(),direction,1.0);
    if disc>0.0 && !(ground.x>=0.0 && ground.y>0.0) {
        let uvSky = atmosphere_skyUv(direction);
        var xyz = vec3f(0.0);
        for(var group=0u;group<arrayLength(&atmosphere_spectrum);group++) {
            let band = atmosphere_spectrum[group];
            let transmission = textureSampleLevel(atmosphere_transmission,atmosphere_sampler,uvSky,i32(group),0.0).xyz;
            xyz += atmosphere_toXYZ(transmission*band.atmosphere_solar.xyz,band);
        }
        radiance += max(vec3f(0.0),atmosphere_xyzToRgb(xyz))*disc/(2.0*atmosphere_PI*(1.0-edge));
    }''')
f.write_text(s,encoding='utf-8',newline='\n')
print('Corrected texture Y mapping, current-position moving cache and bounded GPU submission.')
