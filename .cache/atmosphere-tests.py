from pathlib import Path
import json
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s):
 p=root/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s.lstrip('\n'),encoding='utf8')

put('tests/webgpu.test.ts','''
import { describe, it, expect, vi } from "vitest";
import { AtmosphereSky, atmosphereSkyWgsl } from "../webgpu";
import { copyCamera, split } from "../webgpu/camera";
import type { IAtmosphereCamera } from "../webgpu";
import { makePhysicalScene } from "../src/spectrum";

const model=makePhysicalScene({dustTau:0},[1,1,0]).model;
const camera:IAtmosphereCamera={positionEcefMeters:[6378138,0,0],forwardEcef:[0,1,0],rightEcef:[0,0,-1],upEcef:[1,0,0],halfWidthTangent:1,halfHeightTangent:1,viewportWidth:32,viewportHeight:32};
function gpu(){
    Object.assign(globalThis,{GPUBufferUsage:{COPY_SRC:1,COPY_DST:2,UNIFORM:4,STORAGE:8},GPUTextureUsage:{COPY_SRC:1,COPY_DST:2,TEXTURE_BINDING:4,STORAGE_BINDING:8},GPUShaderStage:{VERTEX:1,FRAGMENT:2,COMPUTE:4}});
    const buffers:Array<{destroy:ReturnType<typeof vi.fn>;data:ArrayBuffer}>=[],textures:Array<{destroy:ReturnType<typeof vi.fn>}>=[];
    let lose!:(value:GPUDeviceLostInfo)=>void;
    const device={lost:new Promise<GPUDeviceLostInfo>(r=>{lose=r;}),limits:{maxTextureDimension2D:8192,maxTextureDimension3D:2048,maxTextureArrayLayers:256,maxStorageBufferBindingSize:134217728,maxStorageTexturesPerShaderStage:4,maxStorageBuffersPerShaderStage:8,maxBufferSize:268435456},queue:{writeBuffer:vi.fn(),writeTexture:vi.fn(),submit:vi.fn()},pushErrorScope:vi.fn(),popErrorScope:vi.fn(async()=>null),createShaderModule:vi.fn(()=>({getCompilationInfo:async()=>({messages:[]})})),createComputePipelineAsync:vi.fn(async()=>({getBindGroupLayout:()=>({})})),createBindGroup:vi.fn(()=>({})),createBindGroupLayout:vi.fn(()=>({})),createSampler:vi.fn(()=>({})),createBuffer:vi.fn((d:GPUBufferDescriptor)=>{const b={destroy:vi.fn(),data:new ArrayBuffer(d.size),getMappedRange(){return this.data;},unmap:vi.fn()};buffers.push(b);return b;}),createTexture:vi.fn(()=>{const t={destroy:vi.fn(),createView:()=>({})};textures.push(t);return t;})};
    const dispatch=vi.fn();const encoder={copyBufferToBuffer:vi.fn(),beginComputePass:vi.fn(()=>({setPipeline:vi.fn(),setBindGroup:vi.fn(),dispatchWorkgroups:dispatch,end:vi.fn()}))};
    return {device:device as unknown as GPUDevice,raw:device,encoder:encoder as unknown as GPUCommandEncoder,buffers,textures,dispatch,lose};
}
describe("host-owned WebGPU contract",()=>{
 it("keeps double precision until splitting and validates basis handedness",()=>{
    const value=1+1e-9,[hi,lo]=split(value);expect(Math.abs(hi+lo-value)).toBeLessThan(1e-14);
    expect(()=>copyCamera({...camera,rightEcef:[0,0,1]},model.ellipsoid)).toThrow(/handedness/);
    expect(()=>copyCamera({...camera,positionEcefMeters:[1,0,0]},model.ellipsoid)).toThrow(/underground/);
    expect(()=>copyCamera({...camera,halfWidthTangent:Infinity},model.ellipsoid)).toThrow(/projection/);
 });
 it("encodes once, reuses on rotation, rebuilds after translation and bounds upload lifetime",async()=>{
    const g=gpu(),sky=await AtmosphereSky.create(g.device,model,{width:8,hemisphereRows:4,viewSteps:8,solarSteps:8});
    expect(()=>sky.bindings()).toThrow(/Encode/);expect(()=>sky.encode(g.encoder)).toThrow(/camera/);
    sky.update(camera);sky.encode(g.encoder);const calls=g.dispatch.mock.calls.length,firstBuffers=[...g.buffers];expect(calls).toBeGreaterThan(1);
    sky.update({...camera,viewportWidth:128});sky.encode(g.encoder);expect(g.dispatch).toHaveBeenCalledTimes(calls);
    sky.update({...camera,positionEcefMeters:[6378140,0,0]});sky.encode(g.encoder);expect(g.dispatch.mock.calls.length).toBe(calls*2-1);
    expect(firstBuffers.some(b=>b.destroy.mock.calls.length===1)).toBe(true);expect(g.raw.queue.submit).not.toHaveBeenCalled();
    sky.dispose();sky.dispose();expect([...g.buffers,...g.textures].every(r=>r.destroy.mock.calls.length===1)).toBe(true);expect(()=>sky.bindings()).toThrow(/disposed/);
 });
 it("cleans partial creation and reports device loss",async()=>{
    const g=gpu();g.raw.createTexture.mockImplementationOnce(()=>{throw new Error('allocation failed');});
    await expect(AtmosphereSky.create(g.device,model)).rejects.toThrow(/allocation failed/);expect(g.buffers.every(b=>b.destroy.mock.calls.length===1)).toBe(true);
    const h=gpu(),sky=await AtmosphereSky.create(h.device,model,{width:8,hemisphereRows:4});h.lose({reason:'unknown',message:'test'});await Promise.resolve();expect(()=>sky.update(camera)).toThrow(/lost/);sky.dispose();
 });
 it("rejects unsupported quality and limits without silent fallback",async()=>{
    const g=gpu();await expect(AtmosphereSky.create(g.device,model,{width:0})).rejects.toThrow(/quality/);
    g.raw.limits.maxTextureArrayLayers=1;await expect(AtmosphereSky.create(g.device,model)).rejects.toThrow(/limits/);expect(g.raw.createBuffer).not.toHaveBeenCalled();
    expect(atmosphereSkyWgsl).not.toMatch(/fetch\\(|replace\\(/);
 });
});
''')

s=(root/'examples/sky-consumer/main.js').read_text();s=s.replace("const device=await adapter.requestDevice(),canvas", "const device=await adapter.requestDevice();device.lost.then(info=>{if(info.reason!=='destroyed'){document.querySelector('#status').textContent='GPU lost: '+info.message;window.skyError=info.message;}});const canvas")
s=s.replace('async function draw(){','let pending=false;async function draw(){if(pending)return;pending=true;try{').replace("document.querySelector('#status').textContent=`Altitude", "await device.queue.onSubmittedWorkDone();document.querySelector('#status').textContent=`Altitude")
s=s.replace(' G for ground.`;}',' G for ground.`;}finally{pending=false;}}')
s=s.replace("document.querySelector('#status').textContent=String(error);throw error;", "document.querySelector('#status').textContent=String(error);window.skyError=String(error);throw error;")
put('examples/sky-consumer/main.js',s)
s=(root/'scripts/test-webgpu.mjs').read_text();s=s.replace("await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Altitude'),{timeout:120000});","await page.waitForFunction(()=>window.skyError||document.querySelector('#status').textContent.startsWith('Altitude'),null,{timeout:120000});if(await page.evaluate(()=>window.skyError))throw new Error(await page.evaluate(()=>window.skyError));")
s=s.replace("console.log(JSON.stringify(report,null,2));","console.log(JSON.stringify({cases:report.cases.length,failures:report.failures,browser:report.browser}));")
put('scripts/test-webgpu.mjs',s)

put('scripts/finalize-build.mjs','''
import {readFile,writeFile} from 'node:fs/promises';
const url=new URL('../dist/webgpu.d.ts',import.meta.url);
await writeFile(url,'/// <reference types="@webgpu/types" />\\n'+await readFile(url,'utf8'));
''')
p=json.loads((root/'package.json').read_text());p['scripts']['build']+=' && node scripts/finalize-build.mjs';p['dependencies']['@webgpu/types']=p['devDependencies'].pop('@webgpu/types');put('package.json',json.dumps(p,indent=4)+'\n')
put('.github/workflows/webgpu.yml','''
name: WebGPU integration
on:
  push:
    branches: [main, "feat/**"]
  pull_request:
    branches: [main]
jobs:
  packed-sky:
    runs-on: windows-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22.x
          cache: npm
      - run: npm ci
      - run: npx playwright install chrome
      - run: npm run test:webgpu
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: webgpu-validation
          path: |
            .cache/webgpu-validation.json
            .cache/sky-consumer.png
''')
