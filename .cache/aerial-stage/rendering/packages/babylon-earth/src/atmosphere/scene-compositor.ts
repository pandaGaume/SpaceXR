/// <reference types="@webgpu/types" />
import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import { Constants } from "@babylonjs/core/Engines/constants.js";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore.js";
import type { WebGPUHardwareTexture } from "@babylonjs/core/Engines/WebGPU/webgpuHardwareTexture.js";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import type { InternalTexture } from "@babylonjs/core/Materials/Textures/internalTexture.js";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage.js";
import { Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Matrix } from "@babylonjs/core/Maths/math.vector.js";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess.js";
import { FxaaPostProcess } from "@babylonjs/core/PostProcesses/fxaaPostProcess.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { atmosphereSkyWgsl,type AtmosphereSky,type AtmosphereAerialVolume,type IAtmosphereCamera } from "@spacexr/atmosphere/webgpu";
import type { IAtmosphere } from "@spacexr/atmosphere";
import { compositeShader } from "./generated/composite";
import { presentShader } from "./generated/present";

interface IFrame {sky:AtmosphereSky;volume:AtmosphereAerialVolume;camera:IAtmosphereCamera}
const scenes=new WeakMap<Scene,{count:number;apply:boolean;clear:Color4}>();
/** Composites actual scene depth with finite-distance physical transport in one HDR pipeline. */
export class BabylonAtmosphereCompositor {
    private readonly post:PostProcess;
    private readonly antialias:FxaaPostProcess;
    private camera:Camera|undefined;
    private frame:IFrame|undefined;
    private pipeline:GPURenderPipeline|undefined;
    private compiling:Promise<void>|undefined;
    private failure:unknown;
    private uniform:GPUBuffer;
    private layout:GPUBindGroupLayout;
    private sampler:GPUSampler;
    private output:GPUTexture|undefined;
    private texture:Texture|undefined;
    private enabled=true;
    private disposed=false;
    public constructor(private readonly scene:Scene,private readonly engine:WebGPUEngine,private readonly model:IAtmosphere,
        private readonly solarRadius:number,private exposure:number) {
        const device=engine._device;
        this.uniform=device.createBuffer({size:160,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
        this.layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},
            {binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},
            {binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},
            ...[3,4].map(binding=>({binding,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float" as const,viewDimension:"3d" as const}})),
            {binding:5,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},
        ]});
        this.sampler=device.createSampler({minFilter:"linear",magFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",addressModeW:"clamp-to-edge"});
        ShaderStore.ShadersStoreWGSL["earthAtmospherePresentPixelShader"]=presentShader;
        this.post=new PostProcess("earth-atmosphere-composition","earthAtmospherePresent",["atmosphereReady","atmosphereExposure"],["earthAtmosphere"],1,null,2,engine,false,null,Constants.TEXTURETYPE_HALF_FLOAT,undefined,undefined,false,Constants.TEXTUREFORMAT_RGBA,ShaderLanguage.WGSL);
        this.post.samples=1;
        this.post.onSizeChangedObservable.add(()=>this.post.inputTexture.createDepthStencilTexture(0,false,false,1,Constants.TEXTUREFORMAT_DEPTH32_FLOAT));
        this.post.onApplyObservable.add(effect=>{
            effect.setFloat("atmosphereReady",0);effect.setFloat("atmosphereExposure",this.exposure);
            if(this.disposed||!this.enabled||!this.frame||!this.pipeline||!this.camera)return;
            if(this.failure)throw this.failure;
            this.compose();effect.setTexture("earthAtmosphere",this.texture!);effect.setFloat("atmosphereReady",1);
        });
        this.antialias=new FxaaPostProcess("earth-atmosphere-antialias",1,null,2,engine);
    }
    public prepareCamera(camera:Camera):void {
        if(this.camera===camera)return;
        if(this.camera)throw new Error("Atmospheric compositor is bound to one camera.");
        this.camera=camera;camera.attachPostProcess(this.post,0);camera.attachPostProcess(this.antialias);
        let state=scenes.get(this.scene);
        if(!state){state={count:0,apply:this.scene.imageProcessingConfiguration.applyByPostProcess,clear:this.scene.clearColor.clone()};scenes.set(this.scene,state);}
        state.count++;this.scene.imageProcessingConfiguration.applyByPostProcess=true;this.scene.clearColor=new Color4(0,0,0,1);
    }
    public setEnabled(value:boolean):void {this.enabled=value;}
    public setExposure(value:number):void {this.exposure=value;}
    public setFrame(sky:AtmosphereSky,volume:AtmosphereAerialVolume,camera:IAtmosphereCamera):void {
        this.frame={sky,volume,camera};
        if(!this.pipeline&&!this.compiling)this.compiling=this.compile(sky).catch(error=>{this.failure=error;});
    }
    private async compile(sky:AtmosphereSky):Promise<void> {
        const device=this.engine._device,layout=sky.bindings().layout;
        const module=device.createShaderModule({code:atmosphereSkyWgsl+compositeShader,label:"Earth HDR aerial composition"});
        const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==="error");if(errors.length)throw new Error(errors.map(m=>m.message).join("\n"));
        const pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout,this.layout]}),vertex:{module,entryPoint:"vertexMain"},fragment:{module,entryPoint:"fragmentMain",targets:[{format:"rgba8unorm"}]}});
        if(!this.disposed)this.pipeline=pipeline;
    }
    private raw(texture:InternalTexture):GPUTextureView {const hardware=texture._hardwareTexture as WebGPUHardwareTexture;if(!hardware.view)hardware.createView();return hardware.view!;}
    private resize(width:number,height:number):void {
        if(this.output?.width===width&&this.output.height===height)return;
        this.texture?.dispose();this.output?.destroy();
        this.output=this.engine._device.createTexture({size:[width,height],format:"rgba8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
        const internal=this.engine.wrapWebGPUTexture(this.output);(internal._hardwareTexture as WebGPUHardwareTexture).createView();this.engine.updateTextureSamplingMode(2,internal);
        this.texture=new Texture(null,this.scene,{internalTexture:internal,noMipmap:true,invertY:false,samplingMode:2});this.texture.wrapU=0;this.texture.wrapV=0;this.texture.gammaSpace=true;
    }
    private compose():void {
        const frame=this.frame!,target=this.post.inputTexture;
        if(!target.depthStencilTexture)throw new Error("Atmosphere requires the scene's readable depth attachment.");
        // Finish Babylon's actual scene pass before sampling its color and depth. The same device/queue is borrowed.
        this.engine.flushFramebuffer();
        const width=target.width,height=target.height;this.resize(width,height);
        const data=new Float32Array(40);data.set([...frame.camera.forwardEcef,0,...frame.camera.rightEcef,frame.camera.halfWidthTangent,...frame.camera.upEcef,frame.camera.halfHeightTangent,width,height,this.exposure,0,...this.model.sun,this.solarRadius]);
        data.set(Matrix.Invert(this.camera!.getProjectionMatrix()).m,20);data.set([this.engine.useReverseDepthBuffer?0:1,0,0,0],36);
        const device=this.engine._device;device.queue.writeBuffer(this.uniform,0,data);
        const aerial=frame.volume.bindings();
        const group=device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.raw(target.texture!)},{binding:2,resource:this.raw(target.depthStencilTexture)},
            {binding:3,resource:aerial.radiance},{binding:4,resource:aerial.transmission},{binding:5,resource:this.sampler}]});
        const encoder=device.createCommandEncoder({label:"Earth surface plus atmosphere"});
        const pass=encoder.beginRenderPass({colorAttachments:[{view:this.output!.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});
        pass.setPipeline(this.pipeline!);pass.setBindGroup(0,frame.sky.bindings().group);pass.setBindGroup(1,group);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);
    }
    public dispose():void {
        if(this.disposed)return;this.disposed=true;this.post.dispose(this.camera);this.antialias.dispose(this.camera);this.texture?.dispose();this.output?.destroy();this.uniform.destroy();
        if(this.camera){const state=scenes.get(this.scene)!;state.count--;if(state.count===0){this.scene.imageProcessingConfiguration.applyByPostProcess=state.apply;this.scene.clearColor=state.clear;scenes.delete(this.scene);}}
    }
}
