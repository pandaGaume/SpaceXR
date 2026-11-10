from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s):
 p=root/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s.lstrip('\n'),encoding='utf8')
put('examples/sky-consumer/probe.js','''
import {atmosphereSkyWgsl} from '@spacexr/atmosphere/webgpu';
/** Explicit diagnostic readback; not used by the rendering loop. */
export async function probeSky(device,sky,directions){
 const module=device.createShaderModule({code:atmosphereSkyWgsl+`
 @group(1) @binding(0) var<storage,read> probeDirections:array<vec4f>;
 @group(1) @binding(1) var<storage,read_write> probeResults:array<vec4f>;
 @compute @workgroup_size(1) fn probeMain(@builtin(global_invocation_id) id:vec3u){
  probeResults[id.x]=vec4f(atmosphere_skyRadiance(probeDirections[id.x].xyz),1.0);
 }`});
 const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}}]});
 const pipeline=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[sky.bindings().layout,layout]}),compute:{module,entryPoint:'probeMain'}});
 const input=device.createBuffer({size:directions.length*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),output=device.createBuffer({size:directions.length*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),staging=device.createBuffer({size:directions.length*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{device.queue.writeBuffer(input,0,new Float32Array(directions.flatMap(d=>[...d,0])));const group=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}]}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,sky.bindings().group);pass.setBindGroup(1,group);pass.dispatchWorkgroups(directions.length);pass.end();encoder.copyBufferToBuffer(output,0,staging,0,directions.length*16);device.queue.submit([encoder.finish()]);await staging.mapAsync(GPUMapMode.READ);const result=new Float32Array(staging.getMappedRange().slice(0));staging.unmap();return directions.map((_,i)=>Array.from(result.slice(i*4,i*4+3)));}finally{input.destroy();output.destroy();staging.destroy();}
}
''')
put('examples/atmosphere-lab/src/public-sky.js','''
import {AtmosphereSky,integrateSpectral} from '@spacexr/atmosphere/webgpu';
import {displayPipeline} from '/sky-consumer/display.js';
import {probeSky} from '/sky-consumer/probe.js';

/** Laboratory presentation and diagnostics around the public renderer. */
export class PublicGpuSky {
 static async create(device,canvas,model,camera,options){
  const renderer=new PublicGpuSky(device,canvas,model,camera,options);
  renderer.sky=await AtmosphereSky.create(device,model,{width:options.width,hemisphereRows:options.hemisphereRows,viewSteps:options.samples,solarSteps:model.solarSteps,...Object.fromEntries(['source','starTemperature','distanceAU','bandCenter','bandWidth','wavelengths'].map(k=>[k,options.spectral.config[k]]))});
  return renderer;
 }
 constructor(device,canvas,model,camera,options){this.device=device;this.canvas=canvas;this.model=model;this.camera=camera;this.origin=[...camera.origin];this.spectral=options.spectral;this.options=options;this.layout={width:options.width,height:options.hemisphereRows*2,samples:options.samples};this.exposure=12;this.sunEnabled=false;this.width=canvas.width;this.height=canvas.height;this.context=canvas.getContext('webgpu');this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device,format:this.format,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});}
 cameraInput(){return {positionEcefMeters:this.camera.origin,forwardEcef:this.camera.forward,rightEcef:this.camera.right,upEcef:this.camera.up,halfWidthTangent:this.camera.halfWidth,halfHeightTangent:this.camera.halfHeight,viewportWidth:this.width,viewportHeight:this.height};}
 resize(width,height){if(![width,height].every(v=>Number.isInteger(v)&&v>0))throw new Error('Invalid viewport');this.width=width;this.height=height;this.canvas.width=width;this.canvas.height=height;}
 writeCamera(camera,exposure=this.exposure){if(!(Number.isFinite(exposure)&&exposure>0))throw new Error('Invalid exposure');this.camera=camera;this.origin=[...camera.origin];this.exposure=exposure;this.sky.update(this.cameraInput());}
 async build(){const start=performance.now(),encoder=this.device.createCommandEncoder();this.sky.update(this.cameraInput());this.sky.encode(encoder);this.display??=await displayPipeline(this.device,this.sky,this.format);this.device.queue.submit([encoder.finish()]);await this.device.queue.onSubmittedWorkDone();return {ms:performance.now()-start,gpuMs:null,width:this.layout.width,height:this.layout.height,samples:this.layout.samples,implementation:'@spacexr/atmosphere/webgpu'};}
 draw(camera=this.camera,exposure=this.exposure){this.writeCamera(camera,exposure);const encoder=this.device.createCommandEncoder();this.sky.encode(encoder);this.display.encode(encoder,this.context.getCurrentTexture().createView(),this.cameraInput(),exposure);this.device.queue.submit([encoder.finish()]);}
 async measureDisplay(){const start=performance.now();this.draw();await this.device.queue.onSubmittedWorkDone();return {ms:performance.now()-start,gpuMs:null,width:this.width,height:this.height,imageReadback:false};}
 async sampleRays(rays){const values=await probeSky(this.device,this.sky,rays);return values.map(radiance=>({radiance}));}
 async validate(){const rays=[];for(const v of [0.2,0.48,0.8])for(const u of [0.2,0.5,0.8])rays.push(this.camera.ray(u,v));const cached=await this.sampleRays(rays),reference=rays.map(d=>integrateSpectral(this.spectral,this.origin,d));let sum=0,max=0;cached.forEach((v,i)=>v.radiance.forEach((x,c)=>{const e=Math.abs(x-reference[i].radiance[c]);sum+=e*e;max=Math.max(max,e);}));return {probes:rays.length,maxRadianceError:max,radianceRMSE:Math.sqrt(sum/(rays.length*3)),reference:'Independent public CPU spectral integration; public packed WebGPU readers',raySamples:rays.map((direction,i)=>({direction,cachedRgb:cached[i].radiance,referenceRgb:reference[i].radiance}))};}
 async capturePng(){this.draw();await this.device.queue.onSubmittedWorkDone();return await new Promise((resolve,reject)=>this.canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG capture failed')),'image/png'));}
 dispose(){this.display?.dispose();this.sky?.dispose();}
}
''')
s=(root/'examples/atmosphere-lab/src/public-sky.js').read_text().replace("import {AtmosphereSky,integrateSpectral} from '@spacexr/atmosphere/webgpu';","import {AtmosphereSky} from '@spacexr/atmosphere/webgpu';\nimport {integrateSpectral} from '@spacexr/atmosphere';");put('examples/atmosphere-lab/src/public-sky.js',s)
s=(root/'examples/atmosphere-lab/src/sky-view.gpu.js').read_text();s="import {PublicGpuSky} from './public-sky.js';\n"+s;s=s.replace('        solarLut.assertCompatible(model);','        if(options.spectral) return PublicGpuSky.create(device,canvas,model,camera,options);\n        solarLut.assertCompatible(model);',1);put('examples/atmosphere-lab/src/sky-view.gpu.js',s)
s=(root/'examples/atmosphere-lab/demo.js').read_text().replace('const solar = await getHdSolarLut(s.model), quality',"const solar = s.spectral ? {lut:null,build:{implementation:'public WebGPU solar columns'},reused:false} : await getHdSolarLut(s.model), quality")
s=s.replace("${s.spectral ? ' Transport spectral physique, '","${s.spectral ? ' API WebGPU publique, disque solaire et sol synthetique exclus. Transport spectral physique, '")
put('examples/atmosphere-lab/demo.js',s)
s=(root/'examples/atmosphere-lab/index.html').read_text().replace('"imports":{','"imports":{"@spacexr/atmosphere/webgpu":"/dist/webgpu.js","@spacexr/atmosphere":"/dist/index.js",');put('examples/atmosphere-lab/index.html',s)
s=(root/'examples/atmosphere-lab/serve.js').read_text().replace("const root = pathname.startsWith('/dist/')", "const root = pathname.startsWith('/sky-consumer/') ? path.join(packageRoot,'examples') : pathname.startsWith('/dist/')");put('examples/atmosphere-lab/serve.js',s)
s=(root/'tests/webgpu.test.ts').read_text().replace('calls * 2 - 1','calls * 2 - 16');put('tests/webgpu.test.ts',s)
