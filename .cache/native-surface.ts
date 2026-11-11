/// <reference types="@webgpu/types" />
import type {Camera} from "@babylonjs/core/Cameras/camera.js";
import type {WebGPUEngine} from "@babylonjs/core/Engines/webgpuEngine.js";
import type {WebGPUHardwareTexture} from "@babylonjs/core/Engines/WebGPU/webgpuHardwareTexture.js";
import type {ShaderMaterial} from "@babylonjs/core/Materials/shaderMaterial.js";
import {Texture} from "@babylonjs/core/Materials/Textures/texture.js";
import {Matrix,Vector3,Vector4} from "@babylonjs/core/Maths/math.vector.js";
import type {Scene} from "@babylonjs/core/scene.js";
import type {IAtmosphere} from "@spacexr/atmosphere";
import {atmosphereAerialDepthWgsl,type AtmosphereAerialVolume,type IAtmosphereCamera} from "@spacexr/atmosphere/webgpu";
import {surfaceShader} from "./generated/surface";
import {atmosphereWhitePoint} from "./display-color";
import type {IAtmosphereSkyOptions} from "@spacexr/atmosphere/webgpu";

/** Binds the existing atmosphere volume directly to the existing terrain fragment shader. No post-process or scene RTT. */
export class BabylonAtmosphereSurface {
    private readonly originalPath:ShaderMaterial["shaderPath"];
    private readonly originalDefines:string[];
    private readonly nativePath:ShaderMaterial["shaderPath"];
    private readonly volumes=new Map<AtmosphereAerialVolume,{light:Texture;transmission:Texture}>();
    private installed=false;
    private enabled=true;
    private disposed=false;
    private readonly white:readonly number[];
    public constructor(private readonly scene:Scene,private readonly engine:WebGPUEngine,private readonly material:ShaderMaterial,private readonly model:IAtmosphere,quality?:IAtmosphereSkyOptions){
        this.originalPath=material.shaderPath;
        this.originalDefines=[...material.options.defines];
        const path=material.shaderPath;
        if(typeof path!=="object"||!path.fragmentSource?.includes("// TERRAIN_FRAGMENT_COLOR"))throw new Error("Atmosphere requires the existing terrain fragment extension point.");
        this.nativePath={...path,fragmentSource:path.fragmentSource.replace("// TERRAIN_FRAGMENT_COLOR","surfaceColor = earthAtmosphereSurface(surfaceColor, fragmentInputs.position);")+"\n"+atmosphereAerialDepthWgsl+surfaceShader};
        this.white=atmosphereWhitePoint(model,quality);
    }
    public setEnabled(enabled:boolean):void {this.enabled=enabled;if(!enabled)this.uninstall();}
    private uninstall():void {if(!this.installed)return;this.material.shaderPath=this.originalPath;this.material.options.defines=[...this.originalDefines];this.material.markDirty(true);this.installed=false;}
    private wrap(resource:GPUTexture):Texture {
        const internal=this.engine.wrapWebGPUTexture(resource);
        internal.is3D=true;internal.width=internal.baseWidth=resource.width;internal.height=internal.baseHeight=resource.height;internal.depth=internal.baseDepth=resource.depthOrArrayLayers;
        (internal._hardwareTexture as WebGPUHardwareTexture).createView({dimension:"3d"});
        this.engine.updateTextureSamplingMode(2,internal);
        const texture=new Texture(null,this.scene,{internalTexture:internal,noMipmap:true,invertY:false,samplingMode:2});
        texture.gammaSpace=false;texture.wrapU=texture.wrapV=texture.wrapR=Texture.CLAMP_ADDRESSMODE;return texture;
    }
    public update(volume:AtmosphereAerialVolume,frame:IAtmosphereCamera,camera:Camera,exposure:number):void {
        if(!this.enabled||this.disposed)return;
        let textures=this.volumes.get(volume);
        if(!textures){const bindings=volume.bindings();textures={light:this.wrap(bindings.radianceResource),transmission:this.wrap(bindings.transmissionResource)};this.volumes.set(volume,textures);}
        const m=this.material,axes=[this.model.ellipsoid.semiMajorAxis,this.model.ellipsoid.semiMajorAxis,this.model.ellipsoid.semiMinorAxis];
        m.setTexture("earthAerialLight",textures.light);m.setTexture("earthAerialTransmission",textures.transmission);
        m.setVector4("earthAtmoViewport",new Vector4(this.engine.getRenderWidth(),this.engine.getRenderHeight(),exposure,1/(Math.PI*1.5)));
        m.setVector4("earthAtmoOrigin",new Vector4(...frame.positionEcefMeters.map((v,i)=>v/axes[i]) as [number,number,number],1+this.model.top/axes[2]));
        m.setVector4("earthAtmoInverseAxes",new Vector4(1000/axes[0],1000/axes[1],1000/axes[2],0));
        m.setVector4("earthAtmoForward",new Vector4(...frame.forwardEcef,0));m.setVector4("earthAtmoRight",new Vector4(...frame.rightEcef,frame.halfWidthTangent));m.setVector4("earthAtmoUp",new Vector4(...frame.upEcef,frame.halfHeightTangent));
        m.setVector3("earthAtmoWhite",Vector3.FromArray(this.white));m.setMatrix("earthAtmoInverseProjection",Matrix.Invert(camera.getProjectionMatrix()));
        if(!this.installed){m.shaderPath=this.nativePath;m.options.defines=[...this.originalDefines,"#define SCENE_LINEAR_COLOR","#define NATIVE_ATMOSPHERE"];m.markDirty(true);this.installed=true;}
    }
    public dispose():void {
        if(this.disposed)return;this.disposed=true;this.uninstall();
        for(const textures of this.volumes.values())for(const texture of [textures.light,textures.transmission]){(texture.getInternalTexture()?._hardwareTexture as WebGPUHardwareTexture|undefined)?.reset();texture.dispose();}
        this.volumes.clear();
    }
}
