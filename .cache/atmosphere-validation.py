from pathlib import Path
import re
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s): (root/n).write_text(s.lstrip('\n'),encoding='utf8')
put('tests/browser/validate.js','''
import {AtmosphereSky,atmosphereSkyWgsl} from '@spacexr/atmosphere/webgpu';
import * as cpu from '@spacexr/atmosphere';

const camera=position=>({positionEcefMeters:position,forwardEcef:[0,1,0],rightEcef:[0,0,-1],upEcef:[1,0,0],halfWidthTangent:1,halfHeightTangent:1,viewportWidth:32,viewportHeight:32});
const normalize=d=>{const n=Math.hypot(...d);return d.map(v=>v/n);};
function basis(lat,lon){return {east:[-Math.sin(lon),Math.cos(lon),0],north:[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)],up:[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]};}
function rays(axes,origin,lat,lon){
 const b=basis(lat,lon);let lo=-Math.PI/2,hi=0;
 for(let i=0;i<52;i++){const e=(lo+hi)/2,d=b.up.map((v,c)=>v*Math.sin(e)+b.east[c]*Math.cos(e)),hit=cpu.intersectEllipsoid(axes,origin,d);if(hit&&hit[0]>=0)lo=e;else hi=e;}
 const horizon=(lo+hi)/2;
 return [b.up,b.up.map(v=>-v),b.east,...[-0.0002,0,0.0002,0.05].map(offset=>b.up.map((v,c)=>v*Math.sin(horizon+offset)+b.east[c]*Math.cos(horizon+offset)))].map(d=>normalize(d.map(Math.fround)));
}
function solarReference(scene,origin,steps){
 const hit=cpu.intersectEllipsoid(scene.model.ellipsoid,origin,scene.model.sun);
 if(hit&&hit[1]>1e-4&&hit[0]>=-1e-4)return [0,0,0];
 const segment=cpu.intersectEllipsoid(scene.model.ellipsoid,origin,scene.model.sun,cpu.envelopeScale(scene.model.ellipsoid,scene.model.top));
 if(!segment||segment[1]<=0)return [1,1,1];
 const start=Math.max(0,segment[0]),ds=(segment[1]-start)/steps,col=scene.model.layers.map(()=>0);
 for(let j=0;j<steps;j++){const rho=scene.model.density(origin.map((v,c)=>v+scene.model.sun[c]*(start+(j+0.5)*ds)));rho.forEach((v,l)=>col[l]+=v*ds);}
 return scene.bins.slice(0,3).map(bin=>Math.exp(-bin.layers.reduce((s,l,i)=>s+l.extinction*col[i],0)));
}
function reference(scene,origin,d,budget){
 let steps=256,solarSteps=192,previous=cpu.integrateSpectral(scene,origin,d,{steps,solarSteps}),current,residual=Infinity;
 while(steps<4096){steps*=2;solarSteps*=2;current=cpu.integrateSpectral(scene,origin,d,{steps,solarSteps});residual=Math.max(...current.radiance.map((v,c)=>Math.abs(v-previous.radiance[c])));if(residual<=budget.referenceConvergence)return {value:current.radiance,residual,steps,solarSteps};previous=current;}
 throw new Error('Independent CPU reference did not converge');
}
export async function validate(){
 const budget=await(await fetch('./tolerances.json')).json(),adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw new Error('WebGPU required; no adapter');
 const device=await adapter.requestDevice(),failures=[],cases=[];
 const report={adapter:{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture},budget,cases,failures};
 device.addEventListener('uncapturederror',e=>failures.push(e.error.message));void device.lost.then(info=>{if(info.reason!=='destroyed')failures.push('Device lost: '+info.message);});
 const base=cpu.makePhysicalScene({planet:'earth',dustTau:0},[1,1,0]);
 const multi=count=>Array.from({length:count},(_,i)=>({id:'gas-'+i,kind:'gas',profile:{...base.model.layers[0].profile,densityScale:1/count},gas:base.model.layers[0].gas}));
 const scenarios=[
  {name:'earth-day',config:{planet:'earth',dustTau:0},sun:[1,1,0],lat:0,heights:[0,1,100,2000,10000,99999,100000,100001,1000000]},
  {name:'earth-north',config:{planet:'earth',dustTau:0},sun:[0,0,1],lat:Math.PI/2,heights:[1,2000]},
  {name:'earth-south',config:{planet:'earth',dustTau:0},sun:[0,0,-1],lat:-Math.PI/2,heights:[1]},
  {name:'earth-midlatitude',config:{planet:'earth',dustTau:0},sun:[1,0,1],lat:Math.PI/4,heights:[1,10000,1000000]},
  {name:'mars-dust',config:{planet:'mars',dustTau:0.3},sun:[1,1,0],lat:0,heights:[1,10000,150000]},
  {name:'earth-terminator',config:{planet:'earth',dustTau:0},sun:[-0.01,1,0],lat:0,heights:[1,60000]},
  {name:'earth-night',config:{planet:'earth',dustTau:0},sun:[-1,0,0],lat:0,heights:[1,150000]},
  {name:'three-layers',config:{layers:multi(3)},sun:[1,1,0],lat:0,heights:[2000]},
  {name:'four-layers-band',config:{layers:multi(4),source:'band',bandCenter:550,bandWidth:80,wavelengths:48},sun:[1,0,1],lat:Math.PI/4,heights:[2000]},
  {name:'zero-density',config:{layers:multi(1).map(l=>({...l,profile:{...l.profile,densityScale:0}}))},sun:[1,1,0],lat:0,heights:[2000]},
 ];
 const module=device.createShaderModule({code:atmosphereSkyWgsl+`
 @group(1) @binding(0) var<storage,read> probeDirections:array<vec4f>;
 @group(1) @binding(1) var<storage,read_write> probeResults:array<vec4f>;
 @compute @workgroup_size(1) fn probeMain(@builtin(global_invocation_id) id:vec3u){
  let d=normalize(probeDirections[id.x].xyz);
  probeResults[3u*id.x]=vec4f(atmosphere_skyRadiance(d),1.0);
  probeResults[3u*id.x+1u]=vec4f(atmosphere_transmittanceToSun(vec3f(0.0),0u),altitude(cameraPoint()));
  probeResults[3u*id.x+2u]=vec4f(intersect(cameraPoint(),d,1.0),d.x,d.y);
 }`});
 const compileInfo=await module.getCompilationInfo();if(compileInfo.messages.some(m=>m.type==='error'))throw new Error(JSON.stringify(compileInfo.messages));
 let pipeline;
 async function encodeProbe(sky,encoder,dirs){
  pipeline??=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[sky.bindings().layout,device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}}]})]}),compute:{module,entryPoint:'probeMain'}});
  const input=device.createBuffer({size:dirs.length*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(input,0,new Float32Array(dirs.flatMap(d=>[...d,0])));
  const output=device.createBuffer({size:dirs.length*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),staging=device.createBuffer({size:dirs.length*48,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}]}),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,sky.bindings().group);pass.setBindGroup(1,group);pass.dispatchWorkgroups(dirs.length);pass.end();encoder.copyBufferToBuffer(output,0,staging,0,dirs.length*48);
  return async()=>{try{await staging.mapAsync(GPUMapMode.READ);const data=Array.from(new Float32Array(staging.getMappedRange().slice(0)));staging.unmap();return data;}finally{input.destroy();output.destroy();staging.destroy();}};
 }
 try{
 for(const scenario of scenarios){
  console.log('Validating',scenario.name);
  const scene=cpu.makePhysicalScene(scenario.config,scenario.sun),options={width:64,hemisphereRows:32,viewSteps:256,solarSteps:192,...Object.fromEntries(['source','starTemperature','distanceAU','bandCenter','bandWidth','wavelengths'].map(k=>[k,scene.config[k]]))};
  const sky=await AtmosphereSky.create(device,scene.model,options),other=await AtmosphereSky.create(device,scene.model,options);
  try{
   for(const height of scenario.heights){
    const origin=cpu.geodeticPosition(scene.model.ellipsoid,scenario.lat,0,height),otherOrigin=cpu.geodeticPosition(scene.model.ellipsoid,scenario.lat,0,height+0.064),dirs=rays(scene.model.ellipsoid,origin,scenario.lat,0);
    sky.update(camera(origin));other.update(camera(otherOrigin));let ready=false;
    while(!ready){const construction=device.createCommandEncoder(),a=sky.encode(construction),b=other.encode(construction);ready=a&&b;device.queue.submit([construction.finish()]);await device.queue.onSubmittedWorkDone();}
    const encoder=device.createCommandEncoder(),read=await encodeProbe(sky,encoder,dirs),readOther=await encodeProbe(other,encoder,dirs);device.queue.submit([encoder.finish()]);const values=await read(),otherValues=await readOther();
    const solar=solarReference(scene,origin,384),solarFine=solarReference(scene,origin,768),solarError=Math.max(...solarFine.map((v,c)=>Math.abs(v-values[4+c])));
    const item={scenario:scenario.name,latitudeRadians:scenario.lat,height,layers:scene.model.layers.length,wavelengths:scene.bins.length,solarError,solarConvergence:Math.max(...solarFine.map((v,c)=>Math.abs(v-solar[c]))),altitudeError:Math.abs(values[7]*1000-height),rays:[]};
    for(let i=0;i<dirs.length;i++){
     const ref=reference(scene,origin,dirs[i],budget),otherRef=reference(scene,otherOrigin,dirs[i],budget),gpu=values.slice(i*12,i*12+3),error=Math.max(...ref.value.map((v,c)=>Math.abs(v-gpu[c]))),otherError=Math.max(...otherRef.value.map((v,c)=>Math.abs(v-otherValues[i*12+c])));
     const relative=Math.max(...ref.value.map((v,c)=>Math.abs(v)>budget.signalFloor?Math.abs(v-gpu[c])/Math.abs(v):0));
     item.rays.push({direction:dirs[i],reference:ref.value,gpu,error,otherError,relative,convergence:ref.residual,steps:ref.steps,solarSteps:ref.solarSteps});
     if(!Number.isFinite(error)||!Number.isFinite(otherError)||error>budget.radianceAbsolute||otherError>budget.radianceAbsolute||relative>budget.radianceRelative)failures.push(`${scenario.name} ${height} ray ${i}: radiance ${error}, other ${otherError}, relative ${relative}`);
    }
    if(solarError>budget.transmittanceAbsolute||item.solarConvergence>budget.transmittanceAbsolute/4)failures.push(`${scenario.name} ${height}: solar ${solarError}, convergence ${item.solarConvergence}`);
    if(item.altitudeError>(height>=10000?budget.intersectionMeters:budget.altitudeMeters))failures.push(`${scenario.name} ${height}: altitude ${item.altitudeError}`);
    cases.push(item);
   }
  }finally{sky.dispose();sky.dispose();other.dispose();}
 }
 await device.queue.onSubmittedWorkDone();return report;
 }finally{device.destroy();}
}
''')
# Namespace all maintained helper declarations, without runtime source rewriting.
names='Pair Point pair add product multiply component pointAdd pointDot cameraPoint intersect altitude interval density extinction solarDirect phase integrate toXYZ xyzToRgb horizonAt skyUv terminator solar RayResult LayerProfile LayerOptics SpectralBand AtmosphereFrame'.split()
for path in list((root/'webgpu/shaders').glob('*.wgsl'))+[root/'tests/browser/validate.js']:
 s=path.read_text()
 for name in names:s=re.sub(r'\b'+name+r'\b','atmosphere_'+name,s)
 path.write_text(s,encoding='utf8')
s=(root/'webgpu/shaders/read.wgsl').read_text().replace('return atmosphere_solar(p,atmosphere_spectrum[wavelengthGroup]);','return atmosphere_solarDirect(p,atmosphere_spectrum[wavelengthGroup]);');put('webgpu/shaders/read.wgsl',s)
# Accept only roundoff-scale underground displacement from geodetic conversions.
s=(root/'webgpu/camera.ts').read_text().replace('altitude, dot,','ecefToGeodetic, dot,').replace('inside(axes, camera.positionEcefMeters) && altitude(axes, camera.positionEcefMeters) < 0','inside(axes, camera.positionEcefMeters) && ecefToGeodetic(axes,{x:camera.positionEcefMeters[0],y:camera.positionEcefMeters[1],z:camera.positionEcefMeters[2]}).height < -1e-5');put('webgpu/camera.ts',s)
