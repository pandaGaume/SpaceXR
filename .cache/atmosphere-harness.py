exec((Path(__file__).parent/'atmosphere-implement.py').read_text().split("put('scripts/build-shaders.mjs'")[0]) if False else None
from pathlib import Path
import json
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(name,content):
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content.lstrip('\n'),encoding='utf8')

put('examples/sky-consumer/package.json','''
{"name":"atmosphere-sky-consumer","private":true,"type":"module","scripts":{"start":"node serve.mjs"},"dependencies":{"@spacexr/atmosphere":"file:../../spacexr-atmosphere-0.1.0.tgz"}}
''')
put('examples/sky-consumer/index.html','''
<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Injected-device atmosphere sky</title>
<style>body{margin:0;background:#080c15;color:#eef;font:16px system-ui}canvas{width:100%;height:80vh;display:block}p{padding:0 1rem}</style>
<canvas width="960" height="540"></canvas><p id="status">Preparing WebGPU. Drag to rotate; use W/S to change altitude.</p>
<script type="importmap">{"imports":{"@spacexr/atmosphere":"/node_modules/@spacexr/atmosphere/dist/index.js","@spacexr/atmosphere/webgpu":"/node_modules/@spacexr/atmosphere/dist/webgpu.js","@spacexr/geodesy":"/node_modules/@spacexr/geodesy/dist/index.js"}}</script>
<script type="module" src="./main.js"></script></html>
''')
put('examples/sky-consumer/serve.mjs','''
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root=dirname(fileURLToPath(import.meta.url));
http.createServer(async(req,res)=>{try{
 const p=resolve(root,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname.replace(/^\\/$/,"/index.html")));
 if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}
 res.setHeader("Content-Type",({".js":"text/javascript",".html":"text/html"})[extname(p)]??"application/octet-stream");res.end(await readFile(p));
}catch{res.writeHead(404).end();}}).listen(Number(process.env.PORT??8098),"127.0.0.1");
''')
put('examples/sky-consumer/display.js','''
import { atmosphereSkyWgsl } from '@spacexr/atmosphere/webgpu';
export async function displayPipeline(device,sky,format) {
 const cameraLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
 const module=device.createShaderModule({code:atmosphereSkyWgsl+`
 struct DisplayCamera {forward:vec4f,right:vec4f,up:vec4f,screen:vec4f}
 @group(1) @binding(0) var<uniform> displayCamera:DisplayCamera;
 @vertex fn vertexMain(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
  let p=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));return vec4f(p[i],0.0,1.0);
 }
 @fragment fn fragmentMain(@builtin(position) pixel:vec4f)->@location(0) vec4f {
  let uv=pixel.xy/displayCamera.screen.xy;
  let d=normalize(displayCamera.forward.xyz+(2.0*uv.x-1.0)*displayCamera.right.w*displayCamera.right.xyz+(1.0-2.0*uv.y)*displayCamera.up.w*displayCamera.up.xyz);
  let linear=max(vec3f(0.0),atmosphere_skyRadiance(d));let mapped=vec3f(1.0)-exp(-linear*displayCamera.screen.z);
  let encoded=select(1.055*pow(mapped,vec3f(1.0/2.4))-vec3f(0.055),12.92*mapped,mapped<=vec3f(0.0031308));return vec4f(encoded,1.0);
 }`});
 const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw new Error(JSON.stringify(info.messages));
 const pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[sky.bindings().layout,cameraLayout]}),vertex:{module,entryPoint:'vertexMain'},fragment:{module,entryPoint:'fragmentMain',targets:[{format}]}});
 const uniform=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 const group=device.createBindGroup({layout:cameraLayout,entries:[{binding:0,resource:{buffer:uniform}}]});
 return {encode(encoder,view,camera,exposure=12){device.queue.writeBuffer(uniform,0,new Float32Array([...camera.forwardEcef,0,...camera.rightEcef,camera.halfWidthTangent,...camera.upEcef,camera.halfHeightTangent,camera.viewportWidth,camera.viewportHeight,exposure,0]));const pass=encoder.beginRenderPass({colorAttachments:[{view,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});pass.setPipeline(pipeline);pass.setBindGroup(0,sky.bindings().group);pass.setBindGroup(1,group);pass.draw(3);pass.end();},dispose(){uniform.destroy();}};
}
''')
put('examples/sky-consumer/main.js','''
import { AtmosphereSky } from '@spacexr/atmosphere/webgpu';
import { spectrum, geometry } from '@spacexr/atmosphere';
import { displayPipeline } from './display.js';
try {
 const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw new Error('WebGPU is required');
 const device=await adapter.requestDevice(),canvas=document.querySelector('canvas'),context=canvas.getContext('webgpu');
 const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
 const scene=spectrum.makePhysicalScene({planet:'earth',dustTau:0},[0.4,0.9,0.1]);
 const sky=await AtmosphereSky.create(device,scene.model,{width:64,hemisphereRows:16,viewSteps:128,solarSteps:96});
 let height=2000,yaw=0,pitch=0,display;
 const camera=()=>({positionEcefMeters:geometry.geodeticPosition(scene.model.ellipsoid,0,0,height),forwardEcef:[Math.sin(pitch),Math.cos(pitch)*Math.cos(yaw),Math.cos(pitch)*Math.sin(yaw)],rightEcef:[0,Math.sin(yaw),-Math.cos(yaw)],upEcef:[Math.cos(pitch),-Math.sin(pitch)*Math.cos(yaw),-Math.sin(pitch)*Math.sin(yaw)],halfWidthTangent:1,halfHeightTangent:canvas.height/canvas.width,viewportWidth:canvas.width,viewportHeight:canvas.height});
 async function draw(){const c=camera(),encoder=device.createCommandEncoder();sky.update(c);sky.encode(encoder);display??=await displayPipeline(device,sky,format);display.encode(encoder,context.getCurrentTexture().createView(),c);device.queue.submit([encoder.finish()]);document.querySelector('#status').textContent=`Altitude ${height} m. Drag to rotate, W/S to translate, O for orbit, G for ground.`;}
 canvas.onpointerdown=e=>canvas.setPointerCapture(e.pointerId);
 canvas.onpointermove=e=>{if(e.buttons){yaw+=e.movementX*0.005;pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*0.005));void draw();}};
 window.onkeydown=e=>{if(e.code==='KeyW')height+=1000;else if(e.code==='KeyS')height=Math.max(1,height-1000);else if(e.code==='KeyO')height=150000;else if(e.code==='KeyG')height=1;else return;void draw();};
 window.addEventListener('pagehide',()=>{display?.dispose();sky.dispose();device.destroy();},{once:true});
 await draw();
} catch(error){document.querySelector('#status').textContent=String(error);throw error;}
''')

put('scripts/test-webgpu.mjs','''
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir,cp } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { execFileSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),consumer=resolve(root,'.cache/sky-consumer');
await mkdir(consumer,{recursive:true});
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(args,cwd){return execFileSync(npm,args,{cwd,encoding:'utf8',shell:process.platform==='win32'});}
const packed=JSON.parse(run(['pack','--ignore-scripts','--json'],root))[0];
await cp(resolve(root,'examples/sky-consumer'),consumer,{recursive:true});
await writeFile(resolve(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{'@spacexr/atmosphere':`file:${resolve(root,packed.filename).replaceAll('\\\\','/')}`}}));
run(['install','--ignore-scripts','--no-audit','--no-fund'],consumer);
await cp(resolve(root,'tests/browser'),resolve(consumer,'tests'),{recursive:true});
await cp(resolve(root,'tests/webgpu-tolerances.json'),resolve(consumer,'tests/tolerances.json'));
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(consumer,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(consumer+sep)){res.writeHead(403).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 const channel=process.env.CHROME_CHANNEL??'chrome';
 browser=await chromium.launch({...(channel==='chromium'?{}:{channel}),headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--disable-vulkan-surface']});
 const page=await browser.newPage();page.setDefaultTimeout(600000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/index.html`);
 const report=await page.evaluate(async()=>await window.validation);
 if(errors.length)throw new Error(errors.join('\\n'));
 report.browser=browser.version();await writeFile(resolve(root,'.cache/webgpu-validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(report.failures.length)process.exitCode=1;
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Altitude'),{timeout:120000});
 await page.screenshot({path:resolve(root,'.cache/sky-consumer.png')});
 if(errors.length)throw new Error(errors.join('\\n'));
} finally { await browser?.close();await new Promise(r=>server.close(r)); }
''')
put('tests/browser/index.html','''
<!doctype html><html><meta charset="utf-8"><script type="importmap">{"imports":{"@spacexr/atmosphere":"/node_modules/@spacexr/atmosphere/dist/index.js","@spacexr/atmosphere/webgpu":"/node_modules/@spacexr/atmosphere/dist/webgpu.js","@spacexr/geodesy":"/node_modules/@spacexr/geodesy/dist/index.js"}}</script><script type="module">import {validate} from './validate.js';window.validation=validate();</script></html>
''')
put('tests/webgpu-tolerances.json',json.dumps({
 'status':'pre-measurement acceptance budget, version 1',
 'rationale':'Absolute scene-linear radiance budget is 0.002 reference-solar-normalized units. Spectral transmittance budget is 0.002. Near-zero signals use absolute error only. Geometry budget is 0.01 m locally, 1 m at orbital distances. These are numerical integration budgets, not observational calibration.',
 'radianceAbsolute':0.002,'radianceRelative':0.05,'signalFloor':0.04,'transmittanceAbsolute':0.002,'referenceConvergence':0.0005,'altitudeMeters':0.01,'intersectionMeters':1
},indent=2))
put('tests/browser/validate.js','''
import { AtmosphereSky,atmosphereSkyWgsl } from '@spacexr/atmosphere/webgpu';
import { spectrum,geometry } from '@spacexr/atmosphere';
export async function validate(){
 const budget=await(await fetch('./tolerances.json')).json();const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw new Error('WebGPU required; no adapter');
 const device=await adapter.requestDevice();const failures=[];device.addEventListener('uncapturederror',e=>failures.push(e.error.message));
 const cases=[],report={adapter:adapter.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description}:{},budget,cases,failures};
 const camera=(position)=>({positionEcefMeters:position,forwardEcef:[0,1,0],rightEcef:[0,0,-1],upEcef:[1,0,0],halfWidthTangent:1,halfHeightTangent:1,viewportWidth:32,viewportHeight:32});
 const scene=spectrum.makePhysicalScene({planet:'earth',dustTau:0,wavelengths:24},[1,1,0]);
 const sky=await AtmosphereSky.create(device,scene.model,{width:32,hemisphereRows:16,viewSteps:256,solarSteps:192});
 const other=await AtmosphereSky.create(device,scene.model,{width:32,hemisphereRows:16,viewSteps:256,solarSteps:192});
 const module=device.createShaderModule({code:atmosphereSkyWgsl+`
 @group(1) @binding(0) var<storage,read> directions:array<vec4f>;
 @group(1) @binding(1) var<storage,read_write> results:array<vec4f>;
 @compute @workgroup_size(1) fn probe(@builtin(global_invocation_id) id:vec3u) {
   results[2u*id.x]=vec4f(atmosphere_skyRadiance(directions[id.x].xyz),1.0);
   results[2u*id.x+1u]=vec4f(atmosphere_transmittanceToSun(vec3f(0.0),0u),altitude(cameraPoint()));
 }`});
 const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw new Error(JSON.stringify(info.messages));
 let pipeline;
 async function encodeProbe(sky,encoder,dirs){
  pipeline??=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[sky.bindings().layout,device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}}]})]}),compute:{module,entryPoint:'probe'}});
  const input=device.createBuffer({size:dirs.length*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(input,0,new Float32Array(dirs.flatMap(d=>[...d,0])));
  const output=device.createBuffer({size:dirs.length*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),staging=device.createBuffer({size:dirs.length*32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}]});
  const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,sky.bindings().group);pass.setBindGroup(1,group);pass.dispatchWorkgroups(dirs.length);pass.end();encoder.copyBufferToBuffer(output,0,staging,0,dirs.length*32);
  return async()=>{await staging.mapAsync(GPUMapMode.READ);const values=Array.from(new Float32Array(staging.getMappedRange().slice(0)));staging.unmap();input.destroy();output.destroy();staging.destroy();return values;};
 }
 for(const height of [1,2000,99999,100000,100001,150000]){
  const origin=geometry.geodeticPosition(scene.model.ellipsoid,0,0,height),dirs=[[1,0,0],[0,1,0],[-1,0,0]];
  sky.update(camera(origin));other.update(camera(geometry.geodeticPosition(scene.model.ellipsoid,0,0,height+0.064)));
  const encoder=device.createCommandEncoder();sky.encode(encoder);other.encode(encoder);const read=await encodeProbe(sky,encoder,dirs),readOther=await encodeProbe(other,encoder,dirs);device.queue.submit([encoder.finish()]);const values=await read();await readOther();
  const record={height,errors:[],altitudeError:Math.abs(values[7]*1000-height)};
  for(let i=0;i<dirs.length;i++){
   const reference=spectrum.integrateSpectral(scene,origin,dirs[i],{steps:512,solarSteps:384}),coarse=spectrum.integrateSpectral(scene,origin,dirs[i],{steps:256,solarSteps:192});
   const convergence=Math.max(...reference.radiance.map((v,c)=>Math.abs(v-coarse.radiance[c]))),error=Math.max(...reference.radiance.map((v,c)=>Math.abs(v-values[i*8+c])));
   record.errors.push({direction:dirs[i],reference:reference.radiance,gpu:values.slice(i*8,i*8+3),error,convergence});
   if(!Number.isFinite(error)||error>budget.radianceAbsolute)failures.push(`height ${height}, ray ${i}: radiance ${error}`);
   if(convergence>budget.referenceConvergence)failures.push(`height ${height}, ray ${i}: reference convergence ${convergence}`);
  }
  if(record.altitudeError>budget.altitudeMeters)failures.push(`height ${height}: altitude ${record.altitudeError} m`);
  cases.push(record);
 }
 sky.dispose();sky.dispose();other.dispose();
 try{sky.update(camera([6378138,0,0]));failures.push('Disposed sky accepted update');}catch{}
 await device.queue.onSubmittedWorkDone();device.destroy();return report;
}
''')
p=json.loads((root/'package.json').read_text());p['scripts']['test:webgpu']='npm run build && node scripts/test-webgpu.mjs';put('package.json',json.dumps(p,indent=4)+'\n')
