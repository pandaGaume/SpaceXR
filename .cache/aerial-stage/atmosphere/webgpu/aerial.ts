/// <reference types="@webgpu/types" />
import geometry from "./generated/geometry";
import transport from "./generated/transport";
import aerial from "./generated/aerial";
import type { IAtmosphereCamera, IAtmosphereSkyBindings } from "./types";

/** Fixed view-frustum volume quality; depths parameterize the clipped atmospheric interval. */
export interface IAtmosphereAerialOptions {
    /** Horizontal ray count, default 32, range 8..128. */ readonly width?:number;
    /** Vertical ray count, default 18, range 4..128. */ readonly height?:number;
    /** Cumulative path samples, default 16, range 4..64. */ readonly depth?:number;
    /** Midpoint integration steps per path interval, default 2, range 1..16. */ readonly segmentSteps?:number;
}
/** Borrowed cumulative, scene-linear RGB transport resources. */
export interface IAtmosphereAerialBindings {
    /** Scattered radiance from the eye to each path fraction. */readonly radiance:GPUTextureView;
    /** White-normalized RGB approximation of spectral transmission, one at zero distance. */readonly transmission:GPUTextureView;
    /** Texel dimensions of both 3D textures. */readonly dimensions:readonly [number,number,number];
}
/** Finite-distance transport using the same spectral integrator and solar resources as AtmosphereSky. */
export class AtmosphereAerialVolume {
    private readonly resources:Array<GPUBuffer|GPUTexture>=[];
    private staging:GPUBuffer|undefined;
    private disposed=false;
    private encoded=false;
    private key="";
    private constructor(private readonly device:GPUDevice,private readonly source:()=>IAtmosphereSkyBindings,
        private readonly dimensions:readonly [number,number,number],private readonly steps:number,
        private readonly pipeline:GPUComputePipeline,private readonly uniform:GPUBuffer,
        private readonly group:GPUBindGroup,private readonly readers:IAtmosphereAerialBindings) {}

    /** Creates resources without submitting commands. The borrowed sky must outlive this volume. */
    public static async create(device:GPUDevice,layout:GPUBindGroupLayout,source:()=>IAtmosphereSkyBindings,options:IAtmosphereAerialOptions={}):Promise<AtmosphereAerialVolume> {
        const size=[options.width??32,options.height??18,options.depth??16] as const,steps=options.segmentSteps??2;
        if(!size.every((v,i)=>Number.isInteger(v)&&v>=(i===0?8:4)&&v<=(i===2?64:128))||!Number.isInteger(steps)||steps<1||steps>16)throw new RangeError("Invalid aerial volume quality");
        if(size.some(v=>v>device.limits.maxTextureDimension3D))throw new Error("Aerial volume exceeds device limits");
        const own:Array<GPUBuffer|GPUTexture>=[];
        try {
            const groupLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},
                ...[1,2].map(binding=>({binding,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only" as const,format:"rgba16float" as const,viewDimension:"3d" as const}}))]});
            const module=device.createShaderModule({code:geometry+transport+aerial,label:"Atmosphere finite-distance transport"});
            const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==="error");if(errors.length)throw new Error(errors.map(m=>m.message).join("\n"));
            const pipeline=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout,groupLayout]}),compute:{module,entryPoint:"atmosphere_bakeAerial"}});
            const uniform=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});own.push(uniform);
            const texture=()=>{const t=device.createTexture({dimension:"3d",size:[...size],format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});own.push(t);return t.createView({dimension:"3d"});};
            const radiance=texture(),transmission=texture();
            const group=device.createBindGroup({layout:groupLayout,entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:radiance},{binding:2,resource:transmission}]});
            const volume=new AtmosphereAerialVolume(device,source,size,steps,pipeline,uniform,group,{radiance,transmission,dimensions:size});volume.resources.push(...own);return volume;
        }catch(error){for(const resource of own)resource.destroy();throw error;}
    }
    /** Encodes one bounded construction when the view changes. Submit before another encode; never submits itself. */
    public encode(encoder:GPUCommandEncoder,camera:IAtmosphereCamera):void {
        if(this.disposed)throw new Error("Aerial volume is disposed");
        const source=this.source();
        const key=JSON.stringify([camera.positionEcefMeters,camera.forwardEcef,camera.rightEcef,camera.upEcef,camera.halfWidthTangent,camera.halfHeightTangent]);
        if(this.encoded&&key===this.key)return;
        const data=new Float32Array([...camera.forwardEcef,this.steps,...camera.rightEcef,camera.halfWidthTangent,...camera.upEcef,camera.halfHeightTangent,0,0,0,0]);
        new Uint32Array(data.buffer).set([...this.dimensions,0],12);
        this.staging?.destroy();this.staging=this.device.createBuffer({size:64,usage:GPUBufferUsage.COPY_SRC,mappedAtCreation:true});
        new Float32Array(this.staging.getMappedRange()).set(data);this.staging.unmap();encoder.copyBufferToBuffer(this.staging,0,this.uniform,0,64);
        const pass=encoder.beginComputePass({label:"Atmosphere aerial volume"});pass.setPipeline(this.pipeline);pass.setBindGroup(0,source.group);pass.setBindGroup(1,this.group);pass.dispatchWorkgroups(Math.ceil(this.dimensions[0]/8),Math.ceil(this.dimensions[1]/4),1);pass.end();
        this.key=key;this.encoded=true;
    }
    /** Readers become usable downstream of the encoder that constructed them. */
    public bindings():IAtmosphereAerialBindings {if(this.disposed||!this.encoded)throw new Error("Encode aerial volume before reading");return this.readers;}
    /** Releases owned resources after their final use has been submitted; the sky remains borrowed. */
    public dispose():void {if(this.disposed)return;this.disposed=true;this.staging?.destroy();for(const resource of this.resources)resource.destroy();}
}
