import {describe,it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({events:[] as string[]}));
vi.mock("@babylonjs/core/Materials/Textures/texture.js",()=>({Texture:class {
    static CLAMP_ADDRESSMODE=0;gammaSpace=true;wrapU=0;wrapV=0;wrapR=0;private internal:unknown;
    constructor(_url:unknown,_scene:unknown,options:{internalTexture:unknown}){this.internal=options.internalTexture;}
    getInternalTexture(){return this.internal;}
    dispose(){state.events.push("dispose");}
}}));
import {Matrix} from "@babylonjs/core/Maths/math.vector.js";
import type {ShaderMaterial} from "@babylonjs/core/Materials/shaderMaterial.js";
import type {Scene} from "@babylonjs/core/scene.js";
import type {WebGPUEngine} from "@babylonjs/core/Engines/webgpuEngine.js";
import type {Camera} from "@babylonjs/core/Cameras/camera.js";
import {makePhysicalScene} from "@spacexr/atmosphere";
import type {AtmosphereAerialVolume,IAtmosphereCamera} from "@spacexr/atmosphere/webgpu";
import {BabylonAtmosphereSurface} from "../src/atmosphere/native-surface";

describe("native atmosphere material lifecycle",()=>{
    it("restores the original material on OFF and never destroys borrowed volume textures",()=>{
        state.events.length=0;
        const path={vertexSource:"@vertex fn main(){#define CUSTOM_VERTEX_MAIN_END\n}",fragmentSource:"@fragment fn main(){var surfaceColor=vec3f(1.0);\n#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR\n}"};
        const options={defines:["#define IMAGERY"],uniforms:["viewProjection"],samplers:["imagery"]};
        const textures=new Map<string,unknown>();
        const material={shaderPath:path,options,markDirty:vi.fn(),setTexture(name:string,texture:unknown){textures.set(name,texture);if(!options.samplers.includes(name))options.samplers.push(name);},removeTexture(name:string){textures.delete(name);},setVector4(name:string){if(!options.uniforms.includes(name))options.uniforms.push(name);},setVector3(name:string){if(!options.uniforms.includes(name))options.uniforms.push(name);},setMatrix(name:string){if(!options.uniforms.includes(name))options.uniforms.push(name);}};
        const wrap=vi.fn(()=>({_hardwareTexture:{createView:vi.fn(),reset(){state.events.push("reset");}}}));
        const engine={wrapWebGPUTexture:wrap,updateTextureSamplingMode(){},getRenderWidth:()=>1200,getRenderHeight:()=>860};
        const resource={width:16,height:9,depthOrArrayLayers:24,destroy:vi.fn()};
        const volume={bindings:()=>({radianceResource:resource,transmissionResource:resource})} as unknown as AtmosphereAerialVolume;
        const frame:IAtmosphereCamera={positionEcefMeters:[6379137,0,0],forwardEcef:[0,1,0],rightEcef:[0,0,-1],upEcef:[1,0,0],halfWidthTangent:1,halfHeightTangent:1,viewportWidth:1200,viewportHeight:860};
        const camera={getProjectionMatrix:()=>Matrix.Identity(),attachPostProcess:vi.fn()};
        const native=new BabylonAtmosphereSurface({} as Scene,engine as unknown as WebGPUEngine,material as unknown as ShaderMaterial,makePhysicalScene({dustTau:0},[1,0,0]).model);
        native.update(volume,frame,camera as unknown as Camera,4);
        expect(material.shaderPath.fragmentSource.indexOf("fn earthAtmosphereSurface")).toBeLessThan(material.shaderPath.fragmentSource.indexOf("@fragment"));
        expect(material.shaderPath.vertexSource).toContain("vAtmosphereClip");expect(textures.size).toBe(2);expect(wrap).toHaveBeenCalledTimes(2);
        native.setEnabled(false);expect(material.shaderPath).toBe(path);expect(options).toEqual({defines:["#define IMAGERY"],uniforms:["viewProjection"],samplers:["imagery"]});expect(textures.size).toBe(0);
        native.update(volume,frame,camera as unknown as Camera,4);expect(material.shaderPath).toBe(path);
        native.setEnabled(true);native.update(volume,frame,camera as unknown as Camera,4);expect(wrap).toHaveBeenCalledTimes(2);
        native.dispose();native.dispose();expect(material.shaderPath).toBe(path);expect(textures.size).toBe(0);expect(state.events).toEqual(["reset","dispose","reset","dispose"]);
        expect(resource.destroy).not.toHaveBeenCalled();expect(camera.attachPostProcess).not.toHaveBeenCalled();
    });
});
