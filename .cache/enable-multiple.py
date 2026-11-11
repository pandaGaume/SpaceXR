from pathlib import Path
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
(a/'webgpu/shaders/multiple.wgsl').write_text(Path('.cache/multiple.wgsl').read_text(encoding='utf-8'),encoding='utf-8')
p=a/'scripts/build-shaders.mjs';s=p.read_text(encoding='utf-8').replace('"solar", "aerial"','"solar", "aerial", "multiple"');p.write_text(s,encoding='utf-8')
p=a/'webgpu/types.ts';s=p.read_text(encoding='utf-8').replace('    /** Azimuth texels,', '    /** Isotropic higher-order scattering closure, precomputed per model snapshot. Default false. No ground bounce. */\n    readonly multipleScattering?: boolean;\n    /** Azimuth texels,');p.write_text(s,encoding='utf-8')
p=a/'webgpu/shaders/transport.wgsl';s=p.read_text(encoding='utf-8');s+='''
@group(0) @binding(9) var atmosphere_multiple:texture_2d_array<f32>;
@group(0) @binding(10) var atmosphere_multipleSampler:sampler;
fn atmosphere_multipleRadiance(p:atmosphere_Point,group:u32)->vec3f {
    if atmosphere_frame.sun.w<0.5 {return vec3f(0.0);}
    let h=clamp(atmosphere_altitude(p),0.0,atmosphere_frame.originHi.w);
    let up=normalize(p.hi*atmosphere_frame.inverseHi.xyz);
    let uv=vec2f(0.5+0.5*dot(up,atmosphere_frame.sun.xyz),sqrt(h/atmosphere_frame.originHi.w));
    let dimensions=vec2f(textureDimensions(atmosphere_multiple));
    return textureSampleLevel(atmosphere_multiple,atmosphere_multipleSampler,(uv*(dimensions-vec2f(1.0))+vec2f(0.5))/dimensions,i32(group),0.0).xyz;
}
'''
s=s.replace('light+=transmission*atmosphere_solar(p,band)*source*weight; transmission*=stepT;', '''var diffuse=vec3f(0.0);
        if atmosphere_frame.sun.w>0.5 {
            var scattering=vec3f(0.0);
            for(var l=0u;l<arrayLength(&atmosphere_profiles);l++){scattering+=rho[l]*(band.layers[l].rayleigh.xyz+band.layers[l].scattering.xyz);}
            diffuse=scattering*atmosphere_multipleRadiance(p,group);
        }
        light+=transmission*(atmosphere_solar(p,band)*source+diffuse)*weight; transmission*=stepT;''')
p.write_text(s,encoding='utf-8')
p=a/'webgpu/index.ts';s=p.read_text(encoding='utf-8').replace('import solarBake from', 'import multipleBake from "./generated/multiple";\nimport solarBake from')
s=s.replace('    private solarCursor = 0;', '    private solarCursor = 0;\n    private multiplePipeline!: GPUComputePipeline;\n    private multipleGroups: GPUBindGroup[] = [];\n    private multipleUniforms: GPUBuffer[] = [];\n    private multipleCursor = 0;\n    private readonly multipleScattering: boolean;')
s=s.replace('        this.width = options.width ?? 64;', '        this.multipleScattering = options.multipleScattering ?? false;\n        this.width = options.width ?? 64;')
s=s.replace('maxSampledTexturesPerShaderStage < 4', 'maxSampledTexturesPerShaderStage < 5')
s=s.replace('        this.solarPipeline = await compile', '        if (this.multipleScattering) this.multiplePipeline = await compile(geometry + transport + multipleBake, "atmosphere_bakeMultiple");\n        this.solarPipeline = await compile')
s=s.replace('            const common: GPUBindGroupEntry[] = [','''            const multipleTexture=this.device.createTexture({size:[32,16,scene.groups],format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_SRC});
            this.resources.push(multipleTexture);
            const multipleView=multipleTexture.createView({dimension:"2d-array"});
            const multipleSampler=this.device.createSampler({minFilter:"linear",magFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});
            const common: GPUBindGroupEntry[] = [''')
s=s.replace('                { binding: 8, resource: solarTexture.createView({ dimension: "3d" }) },\n            ];','                { binding: 8, resource: solarTexture.createView({ dimension: "3d" }) },\n                {binding:9,resource:multipleView},{binding:10,resource:multipleSampler},\n            ];')
s=s.replace('            for (let band = 0; band < scene.groups *', '''            if(this.multipleScattering) for(let band=0;band<scene.groups;band++){
                const uniform=this.buffer(new Float32Array(40),GPUBufferUsage.UNIFORM);this.multipleUniforms.push(uniform);
                this.multipleGroups.push(this.device.createBindGroup({layout:this.multiplePipeline.getBindGroupLayout(0),entries:[...common.filter(e=>[1,2,8].includes(e.binding)),{binding:0,resource:{buffer:uniform}},{binding:4,resource:multipleView}]}));
            }
            for (let band = 0; band < scene.groups *''')
s=s.replace('                    { binding: 6, visibility: all, sampler: { type: "filtering" } },','                    { binding: 6, visibility: all, sampler: { type: "filtering" } },\n                    {binding:9,visibility:all,texture:{viewDimension:"2d-array"}},{binding:10,visibility:all,sampler:{type:"filtering"}},')
s=s.replace('        frame.set(this.model.sun, 16);','        frame.set(this.model.sun, 16);frame[19]=this.multipleScattering?1:0;')
needle='        while (maxDispatches > 0 && this.skyCursor < this.bandUniforms.length) {'
assert needle in s
s=s.replace(needle,'''        while(maxDispatches>0&&this.multipleCursor<this.multipleUniforms.length&&this.solarCursor===this.solarUniforms.length){
            const band=this.multipleCursor++,data=this.frame.slice();new Uint32Array(data.buffer)[39]=band;
            upload(data,this.multipleUniforms[band]);const pass=encoder.beginComputePass({label:"Atmosphere higher-order scattering"});
            pass.setPipeline(this.multiplePipeline);pass.setBindGroup(0,this.multipleGroups[band]);pass.dispatchWorkgroups(4,4,1);pass.end();maxDispatches--;
        }
''' +needle.replace('maxDispatches > 0 &&','maxDispatches > 0 && this.multipleCursor===this.multipleUniforms.length &&'))
s=s.replace('this.encoded = this.solarCursor === this.solarUniforms.length && this.skyCursor', 'this.encoded = this.solarCursor === this.solarUniforms.length && this.multipleCursor === this.multipleUniforms.length && this.skyCursor')
p.write_text(s,encoding='utf-8')
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=r/'packages/babylon-earth/src/atmosphere/babylon-sky.ts';s=p.read_text(encoding='utf-8').replace('const quality = { width:', 'const quality = { multipleScattering:true, width:');p.write_text(s,encoding='utf-8')
