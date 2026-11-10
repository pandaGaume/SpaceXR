import { AtmosphereSky } from "@spacexr/atmosphere/webgpu";
import * as cpu from "@spacexr/atmosphere";

// Independent double-precision angular/segment quadrature. No GPU LUT sampling.
function reference(scene, origin, directions=32, steps=24) {
    const m=scene.model, bins=scene.bins, n=bins.length;
    const up=cpu.normalize(origin),east=cpu.normalize([up[1],-up[0],0]);
    const north=[up[1]*east[2]-up[2]*east[1],up[2]*east[0]-up[0]*east[2],up[0]*east[1]-up[1]*east[0]];
    const light=Array(n).fill(0),returned=Array(n).fill(0);
    for(let sample=0;sample<directions;sample++) {
        const z=1-2*(sample+.5)/directions,phi=sample*2.39996323;
        const d=up.map((v,i)=>z*v+Math.sqrt(1-z*z)*(Math.cos(phi)*east[i]+Math.sin(phi)*north[i]));
        const interval=cpu.atmosphericInterval(m,origin,d);if(!interval)continue;
        const T=Array(n).fill(1);
        for(let step=0;step<steps;step++) {
            const begin=interval.start+(interval.end-interval.start)*(step/steps)**2;
            const end=interval.start+(interval.end-interval.start)*((step+1)/steps)**2;
            const ds=end-begin,p=cpu.along(origin,d,(begin+end)/2),rho=m.density(p);
            const ground=cpu.intersectEllipsoid(m.ellipsoid,p,m.sun),blocked=ground&&ground[1]>1e-4&&ground[0]>=-1e-4;
            const columns=Array(m.layers.length).fill(0);
            if(!blocked){const end=cpu.intersectEllipsoid(m.ellipsoid,p,m.sun,cpu.envelopeScale(m.ellipsoid,m.top))?.[1]??0,ds=end/192;
                for(let j=0;j<192;j++){const r=m.density(cpu.along(p,m.sun,(j+.5)*ds));for(let l=0;l<r.length;l++)columns[l]+=r[l]*ds;}}
            for(let j=0;j<n;j++) {
                const layers=bins[j].layers;let ext=0,scattering=0,tau=0;
                for(let l=0;l<layers.length;l++){ext+=rho[l]*layers[l].extinction;scattering+=rho[l]*(layers[l].rayleigh+layers[l].scattering);tau+=columns[l]*layers[l].extinction;}
                const stepT=Math.exp(-ext*ds),weight=ext>1e-12?-Math.expm1(-ext*ds)/ext:ds;
                returned[j]+=T[j]*scattering*weight/directions;
                light[j]+=T[j]*scattering*weight*(blocked?0:Math.exp(-tau))/(4*Math.PI*directions);T[j]*=stepT;
            }
        }
    }
    return light.map((v,i)=>v/Math.max(1-returned[i],1e-4));
}

export async function validateMultiple(device) {
    const scene=cpu.makePhysicalScene({dustTau:0},[1,0,0]);
    const sky=await AtmosphereSky.create(device,scene.model,{multipleScattering:true,width:8,hemisphereRows:4,viewSteps:16,solarSteps:192});
    const camera={positionEcefMeters:[6379137,0,0],forwardEcef:[0,1,0],rightEcef:[0,0,-1],upEcef:[1,0,0],halfWidthTangent:1,halfHeightTangent:1,viewportWidth:32,viewportHeight:32};
    const points=[[31,0],[24,2],[16,5],[4,4]],groups=scene.groups,count=points.length*groups;
    const output=device.createBuffer({size:count*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    const read=device.createBuffer({size:count*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try{
        sky.update(camera);const encoder=device.createCommandEncoder();sky.encode(encoder,4096);
        const module=device.createShaderModule({code:`@group(0) @binding(0) var lut:texture_2d_array<f32>;@group(0) @binding(1) var<storage,read_write> out:array<vec4f>;
        @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3u){let points=array<vec2i,4>(vec2i(31,0),vec2i(24,2),vec2i(16,5),vec2i(4,4));out[id.x]=textureLoad(lut,points[id.x/8u],i32(id.x%8u),0);}`});
        const pipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module,entryPoint:"main"}});
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:sky.bindings().multipleRadiance},{binding:1,resource:{buffer:output}}]});
        const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(count);pass.end();encoder.copyBufferToBuffer(output,0,read,0,count*16);device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);const values=Array.from(new Float32Array(read.getMappedRange()));read.unmap();
        const cases=[],failures=[];
        for(let i=0;i<points.length;i++){
            const [x,y]=points[i],mu=2*x/31-1,h=Math.max(1,scene.model.top*(y/15)**2),a=scene.model.ellipsoid.semiMajorAxis;
            const expected=reference(scene,[(a+h)*mu,-(a+h)*Math.sqrt(1-mu*mu),0]);
            const actual=Array.from({length:24},(_,w)=>values[i*groups*4+Math.floor(w/3)*4+w%3]);
            const error=Math.max(...actual.map((v,w)=>Math.abs(v-expected[w])));
            if(!actual.every(v=>Number.isFinite(v)&&v>=0)||error>0.003)failures.push(`Multiple scattering ${x},${y}: ${error}`);
            cases.push({mu,height:h,maxError:error,actual,expected});
        }
        return {cases,failures};
    }finally{await device.queue.onSubmittedWorkDone();sky.dispose();output.destroy();read.destroy();}
}
