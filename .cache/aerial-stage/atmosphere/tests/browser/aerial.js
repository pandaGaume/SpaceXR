import { AtmosphereSky } from "@spacexr/atmosphere/webgpu";
import * as cpu from "@spacexr/atmosphere";

/** GPU readback is confined to this explicit scientific test, never the runtime frame path. */
export async function validateAerial(device) {
    const scene=cpu.makePhysicalScene({dustTau:0},[1,0.5,0]);
    const origin=[scene.model.ellipsoid.semiMajorAxis+2000,0,0],direction=[0,1,0];
    const camera={positionEcefMeters:origin,forwardEcef:direction,rightEcef:[0,0,-1],upEcef:[1,0,0],halfWidthTangent:0.2,halfHeightTangent:0.2,viewportWidth:9,viewportHeight:5};
    const sky=await AtmosphereSky.create(device,scene.model,{width:16,hemisphereRows:8,viewSteps:64,solarSteps:192});
    const volume=await sky.createAerialVolume({width:9,height:5,depth:17,segmentSteps:2});
    const output=device.createBuffer({size:17*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    const read=device.createBuffer({size:17*32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try {
        const module=device.createShaderModule({code:`
@group(0) @binding(0) var light:texture_3d<f32>;
@group(0) @binding(1) var transmission:texture_3d<f32>;
@group(0) @binding(2) var<storage,read_write> result:array<vec4f>;
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3u) {
    result[2u*id.x]=textureLoad(light,vec3i(4,2,i32(id.x)),0);
    result[2u*id.x+1u]=textureLoad(transmission,vec3i(4,2,i32(id.x)),0);
}`});
        const pipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module,entryPoint:"main"}});
        sky.update(camera);const encoder=device.createCommandEncoder();sky.encode(encoder,4096);volume.encode(encoder,camera);
        const views=volume.bindings();
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:views.radiance},{binding:1,resource:views.transmission},{binding:2,resource:{buffer:output}}]});
        const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(17);pass.end();encoder.copyBufferToBuffer(output,0,read,0,17*32);device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);const values=Array.from(new Float32Array(read.getMappedRange()));read.unmap();
        const interval=cpu.atmosphericInterval(scene.model,origin,direction);
        const white=cpu.integrateSpectral(scene,origin,direction,{maxDistanceMeters:0}).transmittance;
        const cases=[];let maxRadianceError=0,maxTransmissionError=0;
        for(const z of [0,1,4,8,16]) {
            const distance=interval.start+(interval.end-interval.start)*z/16;
            const reference=cpu.integrateSpectral(scene,origin,direction,{maxDistanceMeters:distance,steps:512,solarSteps:192});
            const light=values.slice(z*8,z*8+3),transmission=values.slice(z*8+4,z*8+7);
            const expected=reference.transmittance.map((v,i)=>Math.max(0,Math.min(1,v/white[i])));
            const lightError=Math.max(...light.map((v,i)=>Math.abs(v-Math.max(0,reference.radiance[i]))));
            const transError=Math.max(...transmission.map((v,i)=>Math.abs(v-expected[i])));
            maxRadianceError=Math.max(maxRadianceError,lightError);maxTransmissionError=Math.max(maxTransmissionError,transError);
            cases.push({fraction:z/16,distance,light,transmission,reference:reference.radiance,expectedTransmission:expected,lightError,transError});
        }
        const failures=[];
        if(maxRadianceError>0.012||!Number.isFinite(maxRadianceError))failures.push(`Aerial radiance error ${maxRadianceError}`);
        if(maxTransmissionError>0.03||!Number.isFinite(maxTransmissionError))failures.push(`Aerial transmission error ${maxTransmissionError}`);
        if(cases[0].light.some(v=>Math.abs(v)>1e-6)||cases[0].transmission.some(v=>Math.abs(v-1)>0.001))failures.push("Aerial zero-distance identity failed");
        return {cases,maxRadianceError,maxTransmissionError,failures};
    }finally{await device.queue.onSubmittedWorkDone();volume.dispose();sky.dispose();output.destroy();read.destroy();}
}
