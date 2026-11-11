from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s): (root/n).write_text(s,encoding='utf8')
p=root/'webgpu/shaders/transport.wgsl';s=p.read_text();s=s.replace('fn solar(p:Point,band:SpectralBand)->vec3f {','fn solarDirect(p:Point,band:SpectralBand)->vec3f {')
s+='''
@group(0) @binding(8) var atmosphere_solarColumns:texture_3d<f32>;
fn terminator(latitude:f32)->f32 {
    let denominator=max(1e-8,cos(latitude)*sqrt(max(0.0,1.0-atmosphere_frame.sun.z*atmosphere_frame.sun.z)));
    return acos(clamp(-sin(latitude)*atmosphere_frame.sun.z/denominator,-cos(0.1),cos(0.1)));
}
fn solar(p:Point,band:SpectralBand)->vec3f {
    let direction=atmosphere_frame.sun.xyz; let ground=intersect(p,direction,1.0);
    if ground.y>1e-7 && ground.x>=-1e-7 { return vec3f(0.0); }
    let h=altitude(p);
    if h<0.0 || h>atmosphere_frame.originHi.w { return solarDirect(p,band); }
    let inv=atmosphere_frame.inverseHi.xyz;
    var n=normalize(p.hi*inv);
    for(var k=0u;k<3u;k++) { n=normalize(pointAdd(p,n,-h).hi*inv); }
    let latitude=asin(clamp(n.z,-1.0,1.0));
    let longitude=atan2(p.hi.y,p.hi.x)-atan2(direction.y,direction.x);
    let angle=abs((fract(longitude/(2.0*PI)+0.5)-0.5)*2.0*PI);let center=terminator(latitude);
    let u=select(0.5+0.5*sqrt(max(0.0,(angle-center)/(PI-center))),0.5*(1.0-sqrt(max(0.0,(center-angle)/center))),angle<center);
    let dimensions=vec3i(textureDimensions(atmosphere_solarColumns));
    let coord=vec3f(u,latitude/PI+0.5,sqrt(clamp(h/atmosphere_frame.originHi.w,0.0,1.0)))*vec3f(dimensions-vec3i(1));
    let base=vec3i(floor(coord));let f=fract(coord);var col=vec4f(0.0);
    for(var c=0u;c<8u;c++) {
        let shift=vec3i(i32(c&1u),i32((c>>1u)&1u),i32((c>>2u)&1u));let weights=select(vec3f(1.0)-f,f,shift>vec3i(0));let w=weights.x*weights.y*weights.z;
        if w>1e-7 { let value=textureLoad(atmosphere_solarColumns,clamp(base+shift,vec3i(0),dimensions-vec3i(1)),0);if value.x<0.0 {return solarDirect(p,band);}col+=w*value; }
    }
    return exp(-extinction(col,band));
}
'''
put('webgpu/shaders/transport.wgsl',s)
put('webgpu/shaders/solar.wgsl','''
@group(0) @binding(4) var solarOutput:texture_storage_3d<rgba32float,write>;
@group(0) @binding(9) var<storage,read> solarPoints:array<vec4f>;
@compute @workgroup_size(8,4,1)
fn atmosphere_bakeSolar(@builtin(global_invocation_id) id:vec3u) {
    let dims=textureDimensions(solarOutput);if any(id>=dims) {return;}
    let index=(id.z*dims.y+id.y)*dims.x+id.x;
    let p=Point(solarPoints[2u*index].xyz,solarPoints[2u*index+1u].xyz);
    let direction=atmosphere_frame.sun.xyz;let ground=intersect(p,direction,1.0);
    if ground.y>1e-7 && ground.x>=-1e-7 {textureStore(solarOutput,vec3i(id),vec4f(-1.0));return;}
    let outer=intersect(p,direction,atmosphere_frame.inverseHi.w);let start=max(0.0,outer.x);let end=max(start,outer.y);
    let count=atmosphere_frame.quality.y;let ds=(end-start)/f32(count);var col=vec4f(0.0);
    for(var i=0u;i<count;i++){col+=density(pointAdd(p,direction,start+(f32(i)+0.5)*ds))*ds;}
    textureStore(solarOutput,vec3i(id),col);
}
''')
s=(root/'scripts/build-shaders.mjs').read_text().replace('"read", "bake"','"read", "bake", "solar"');put('scripts/build-shaders.mjs',s)
s=(root/'webgpu/index.ts').read_text();s=s.replace('import bake from "./generated/bake";','import bake from "./generated/bake";\nimport solarBake from "./generated/solar";\nimport { geodeticPosition } from "../src/geometry";')
s=s.replace('private readonly resources:', 'private readonly uploads: GPUBuffer[] = [];\n    private solarPipeline!:GPUComputePipeline;\n    private solarGroup!:GPUBindGroup;\n    private solarEncoded=false;\n    private readonly resources:')
needle='const common: GPUBindGroupEntry[] = ['
insert='''const solarSize=[64,32,32];
            const solarTexture=this.device.createTexture({dimension:"3d",size:solarSize,format:"rgba32float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});this.resources.push(solarTexture);
            const points=new Float32Array(solarSize[0]*solarSize[1]*solarSize[2]*8);
            const declination=this.model.sun[2],sunLongitude=Math.atan2(this.model.sun[1],this.model.sun[0]);
            for(let z=0;z<solarSize[2];z++) for(let y=0;y<solarSize[1];y++) for(let x=0;x<solarSize[0];x++) {
                const latitude=(y/(solarSize[1]-1)-0.5)*Math.PI;
                const center=Math.acos(Math.max(-Math.cos(0.1),Math.min(Math.cos(0.1),-Math.sin(latitude)*declination/Math.max(1e-8,Math.cos(latitude)*Math.sqrt(Math.max(0,1-declination**2))))));
                const t=2*x/(solarSize[0]-1)-1,longitude=(t<0?center*(1-t*t):center+(Math.PI-center)*t*t)+sunLongitude;
                const point=geodeticPosition(this.model.ellipsoid,latitude,longitude,this.model.top*(z/(solarSize[2]-1))**2);
                const offset=((z*solarSize[1]+y)*solarSize[0]+x)*8;
                for(let i=0;i<3;i++){const axis=i===2?this.model.ellipsoid.semiMinorAxis:this.model.ellipsoid.semiMajorAxis;const [hi,lo]=split(point[i]/axis);points[offset+i]=hi;points[offset+4+i]=lo;}
            }
            const pointBuffer=this.buffer(points,GPUBufferUsage.STORAGE);
            const solarModule=this.device.createShaderModule({code:geometry+transport+solarBake});
            const solarInfo=await solarModule.getCompilationInfo();if(solarInfo.messages.some(m=>m.type==="error"))throw new Error(solarInfo.messages.map(m=>m.message).join("\\n"));
            this.solarPipeline=await this.device.createComputePipelineAsync({layout:"auto",compute:{module:solarModule,entryPoint:"atmosphere_bakeSolar"}});
            this.solarGroup=this.device.createBindGroup({layout:this.solarPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:{buffer:profileBuffer}},{binding:4,resource:solarTexture.createView({dimension:"3d"})},{binding:9,resource:{buffer:pointBuffer}}]});
            '''
s=s.replace(needle,insert+needle)
s=s.replace('{ binding: 7, resource: { buffer: this.horizonBuffer } },','{ binding: 7, resource: { buffer: this.horizonBuffer } },\n                { binding: 8, resource: solarTexture.createView({dimension:"3d"}) },')
s=s.replace('const layout = this.device.createBindGroupLayout({','const layout = this.device.createBindGroupLayout({')
s=s.replace('{ binding: 3, visibility: all, texture: { sampleType: "unfilterable-float" } },','{ binding: 3, visibility: all, texture: { sampleType: "unfilterable-float" } },\n                    { binding: 8, visibility: all, texture: { sampleType: "unfilterable-float",viewDimension:"3d" } },')
s=s.replace('if (this.dirty) {','if (this.dirty) {\n            for(const upload of this.uploads) upload.destroy();\n            this.uploads.length=0;')
s=s.replace('this.resources.push(staging);','this.uploads.push(staging);')
s=s.replace('const pass = encoder.beginComputePass({ label: "Atmosphere Sky-View" });','''if(!this.solarEncoded){
                const solarPass=encoder.beginComputePass({label:"Atmosphere solar columns"});solarPass.setPipeline(this.solarPipeline);solarPass.setBindGroup(0,this.solarGroup);solarPass.dispatchWorkgroups(8,8,32);solarPass.end();this.solarEncoded=true;
            }
            const pass = encoder.beginComputePass({ label: "Atmosphere Sky-View" });''')
s=s.replace('for (const resource of this.resources) resource.destroy();','for (const resource of [...this.resources,...this.uploads]) resource.destroy();\n        this.uploads.length=0;')
put('webgpu/index.ts',s)
