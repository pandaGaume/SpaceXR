/// <reference types="@webgpu/types" />
import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine.js";
import { Layer } from "@babylonjs/core/Layers/layer.js";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { IAtmosphere } from "@spacexr/atmosphere";
import { AtmosphereSky, atmosphereSkyWgsl, type IAtmosphereCamera, type IAtmosphereSkyOptions } from "@spacexr/atmosphere/webgpu";
import { atmosphereCamera } from "./camera";
import { displayShader } from "./generated/display";

export interface IEarthAtmosphereOptions {
    /** Public spectral backend quality. Defaults favour an interactive desktop preview. */
    quality?: IAtmosphereSkyOptions;
    /** Sky output width, in pixels. Its height follows the viewport aspect ratio. Default 768. */
    width?: number;
    /** Display exposure, default 12. Does not alter physical coefficients. */
    exposure?: number;
    /** Construction tasks submitted per update. Default 8. */
    dispatchesPerFrame?: number;
}

/** Internal Babylon bridge. Scattering and LUT construction stay in @spacexr/atmosphere. */
export class BabylonEarthSky {
    private readonly layer: Layer;
    private texture: BaseTexture | undefined;
    private output: GPUTexture | undefined;
    private uniform: GPUBuffer;
    private pipeline: GPURenderPipeline | undefined;
    private compiling: Promise<void> | undefined;
    private group: GPUBindGroup | undefined;
    private readonly cameraLayout: GPUBindGroupLayout;
    private baking = false;
    private baked: IAtmosphereCamera | undefined;
    private disposed = false;
    private failure: unknown;
    private enabled = true;
    private exposure: number;
    public ready = false;
    private constructor(private readonly scene: Scene, private readonly engine: WebGPUEngine,
        private readonly device: GPUDevice, private readonly sky: AtmosphereSky, private readonly options: IEarthAtmosphereOptions) {
        this.exposure = options.exposure ?? 12;
        this.layer = new Layer("earth-atmosphere", null, scene, true);
        this.layer.isEnabled = false;
        this.cameraLayout = device.createBindGroupLayout({ entries: [{ binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"} }] });
        this.uniform = device.createBuffer({ size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
        this.group = device.createBindGroup({layout:this.cameraLayout,entries:[{binding:0,resource:{buffer:this.uniform}}]});
        const weak = new WeakRef(this);
        void device.lost.then(info => { const target=weak.deref(); if(target && !target.disposed) target.failure=new Error(`Atmosphere GPU lost: ${info.message}`); });
    }
    public static async create(scene: Scene, model: IAtmosphere, options: IEarthAtmosphereOptions = {}): Promise<BabylonEarthSky> {
        const engine = scene.getEngine();
        if (!(engine instanceof WebGPUEngine)) throw new Error("Earth atmospheric rendering currently requires Babylon WebGPU. Pass atmosphere:false for WebGL terrain.");
        const width=options.width ?? 768, exposure=options.exposure ?? 12, dispatches=options.dispatchesPerFrame ?? 8;
        if (!Number.isInteger(width) || width<64 || width>4096 || !Number.isFinite(exposure) || exposure<=0 || !Number.isInteger(dispatches) || dispatches<1 || dispatches>4096)
            throw new RangeError("Invalid Earth atmosphere display quality.");
        // Babylon 9.33 exposes no public device getter. Keep this version-dependent bridge isolated here.
        const device=engine._device;
        const sky=await AtmosphereSky.create(device,model,{width:32,hemisphereRows:16,viewSteps:64,solarSteps:48,...options.quality});
        try { return new BabylonEarthSky(scene,engine,device,sky,options); }
        catch(error) { sky.dispose(); throw error; }
    }
    public setEnabled(value: boolean): void { this.enabled=value; this.layer.isEnabled=value && this.ready; }
    public setExposure(value: number): void {
        if(!Number.isFinite(value) || value<=0) throw new RangeError("Exposure must be positive.");
        this.exposure=value;
    }
    /** Called before Babylon begins its frame, with no open engine pass. */
    public update(camera: Camera): void {
        if(this.disposed) throw new Error("Earth atmosphere is disposed.");
        if(this.failure) throw this.failure;
        if(!this.enabled) return;
        const width=this.options.width ?? 768;
        const height=Math.max(1,Math.round(width*this.engine.getRenderHeight()/this.engine.getRenderWidth()));
        const current=atmosphereCamera(camera,width,height);
        // Finish each translated snapshot before applying the newest position. Never restart an unfinished bake.
        if(!this.baking && (!this.baked || current.positionEcefMeters.some((v,i)=>v!==this.baked!.positionEcefMeters[i]))) {
            this.sky.update(current); this.baking=true;
        }
        const encoder=this.device.createCommandEncoder({label:"Earth sky before Babylon"});
        const ready=this.sky.encode(encoder,this.options.dispatchesPerFrame ?? 8);
        if(ready) {
            if(this.baking) { this.baked=current; this.baking=false; }
            if(!this.pipeline && !this.compiling) this.compiling=this.compile().catch(error=>{this.failure=error;});
            if(this.pipeline) {
                this.resize(width,height);
                this.device.queue.writeBuffer(this.uniform,0,new Float32Array([
                    ...current.forwardEcef,0,...current.rightEcef,current.halfWidthTangent,
                    ...current.upEcef,current.halfHeightTangent,width,height,this.exposure,0,
                ]));
                const pass=encoder.beginRenderPass({colorAttachments:[{view:this.output!.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});
                pass.setPipeline(this.pipeline); pass.setBindGroup(0,this.sky.bindings().group); pass.setBindGroup(1,this.group!); pass.draw(3); pass.end();
                this.ready=true; this.layer.isEnabled=true;
            }
        }
        this.device.queue.submit([encoder.finish()]);
    }
    private async compile(): Promise<void> {
        const module=this.device.createShaderModule({code:atmosphereSkyWgsl+displayShader,label:"Earth sky display"});
        const info=await module.getCompilationInfo();
        const errors=info.messages.filter(m=>m.type==="error");
        if(errors.length) throw new Error(errors.map(m=>m.message).join("\n"));
        const pipeline=await this.device.createRenderPipelineAsync({
            layout:this.device.createPipelineLayout({bindGroupLayouts:[this.sky.bindings().layout,this.cameraLayout]}),
            vertex:{module,entryPoint:"vertexMain"},fragment:{module,entryPoint:"fragmentMain",targets:[{format:"rgba8unorm"}]},
        });
        if(!this.disposed) this.pipeline=pipeline;
    }
    private resize(width: number,height: number): void {
        if(this.output?.width===width && this.output.height===height) return;
        this.layer.texture=null;
        this.texture?.dispose(); this.output?.destroy();
        this.output=this.device.createTexture({label:"Earth sky display",size:[width,height],format:"rgba8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
        this.texture=new BaseTexture(this.scene,this.engine.wrapWebGPUTexture(this.output));
        this.texture.gammaSpace=true;
        this.layer.texture=this.texture;
    }
    public dispose(): void {
        if(this.disposed) return;
        this.disposed=true; this.layer.texture=null; this.layer.dispose();
        this.texture?.dispose(); this.output?.destroy(); this.uniform.destroy(); this.sky.dispose();
    }
}
