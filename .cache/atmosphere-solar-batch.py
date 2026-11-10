from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
p=root/'webgpu/index.ts';s=p.read_text()
s=s.replace('private solarGroup!: GPUBindGroup;','private solarGroups:GPUBindGroup[]=[];\n    private solarUniforms:GPUBuffer[]=[];')
start=s.index('            this.solarGroup = this.device.createBindGroup(')
end=s.index('            const common:',start)
s=s[:start]+'''            for(let slice=0;slice<16;slice++) {
                const uniform=this.buffer(new Float32Array(40),GPUBufferUsage.UNIFORM);this.solarUniforms.push(uniform);
                this.solarGroups.push(this.device.createBindGroup({layout:this.solarPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:{buffer:profileBuffer}},{binding:4,resource:solarTexture.createView({dimension:"3d"})},{binding:9,resource:{buffer:pointBuffer}}]}));
            }
'''+s[end:]
start=s.index('                const solarPass = encoder.beginComputePass(')
end=s.index('                this.solarEncoded = true;',start)
s=s[:start]+'''                for(let slice=0;slice<this.solarUniforms.length;slice++) {
                    const data=this.frame.slice();new Uint32Array(data.buffer)[34]=slice;
                    const staging=this.device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.COPY_SRC,mappedAtCreation:true});new Float32Array(staging.getMappedRange()).set(data);staging.unmap();encoder.copyBufferToBuffer(staging,0,this.solarUniforms[slice],0,data.byteLength);this.uploads.push(staging);
                    const solarPass=encoder.beginComputePass({label:"Atmosphere solar slice"});solarPass.setPipeline(this.solarPipeline);solarPass.setBindGroup(0,this.solarGroups[slice]);solarPass.dispatchWorkgroups(4,4,1);solarPass.end();
                }
'''+s[end:]
p.write_text(s,encoding='utf8')
p=root/'webgpu/shaders/solar.wgsl';s=p.read_text().replace('fn atmosphere_bakeSolar(@builtin(global_invocation_id) id:vec3u) {','fn atmosphere_bakeSolar(@builtin(global_invocation_id) invocation:vec3u) {\n    let id=vec3u(invocation.xy,invocation.z+atmosphere_frame.quality.z);');p.write_text(s,encoding='utf8')
