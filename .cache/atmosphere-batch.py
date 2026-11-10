from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s): (root/n).write_text(s,encoding='utf8')
s=(root/'webgpu/index.ts').read_text()
s=s.replace('private buildGroup!: GPUBindGroup;','private buildGroup!: GPUBindGroup;\n    private bandGroups:GPUBindGroup[]=[];\n    private bandUniforms:GPUBuffer[]=[];')
needle='const all = GPUShaderStage.VERTEX'
insert='''for(let band=0;band<scene.groups;band++) {
                const bandUniform=this.buffer(new Float32Array(40),GPUBufferUsage.UNIFORM);this.bandUniforms.push(bandUniform);
                const views=[radiance,transmission].map(view=>view);
                this.bandGroups.push(this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[...common.filter(e=>e.binding!==0),{binding:0,resource:{buffer:bandUniform}},{binding:4,resource:views[0]},{binding:5,resource:views[1]}]}));
            }
            '''
s=s.replace(needle,insert+needle)
s=s.replace('this.uploads.push(staging);','this.uploads.push(staging);')
old='''const pass = encoder.beginComputePass({ label: "Atmosphere Sky-View" });
            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, this.buildGroup);
            pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil((this.rows * 2) / 4), this.wavelengths / 3);
            pass.end();'''
new='''for(let band=0;band<this.bandUniforms.length;band++) {
                const data=this.frame.slice();new Uint32Array(data.buffer)[39]=band;
                const staging=this.device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.COPY_SRC,mappedAtCreation:true});new Float32Array(staging.getMappedRange()).set(data);staging.unmap();encoder.copyBufferToBuffer(staging,0,this.bandUniforms[band],0,data.byteLength);this.uploads.push(staging);
                const pass=encoder.beginComputePass({label:"Atmosphere spectral Sky-View band"});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bandGroups[band]);pass.dispatchWorkgroups(Math.ceil(this.width/8),Math.ceil(this.rows*2/4),1);pass.end();
            }'''
if old not in s: raise Exception('missing compute block')
s=s.replace(old,new);s=s.replace('private buildGroup!: GPUBindGroup;','')
start=s.index('            this.buildGroup = this.device.createBindGroup(')
end=s.index('            for(let band=',start)
s=s[:start]+s[end:]
put('webgpu/index.ts',s)
s=(root/'webgpu/shaders/bake.wgsl').read_text().replace('let rows=','let group=atmosphere_frame.size.w;\n    let rows=').replace('integrate(direction,id.z)','integrate(direction,group)').replace('i32(id.z)','i32(group)');put('webgpu/shaders/bake.wgsl',s)
s=(root/'webgpu/shaders/geometry.wgsl').read_text().replace('k<6u','k<3u');put('webgpu/shaders/geometry.wgsl',s)
s=(root/'tests/browser/validate.js').read_text().replace('viewSteps:8,solarSteps:8','viewSteps:128,solarSteps:96').replace('record.altitudeError>budget.altitudeMeters','record.altitudeError>(height>=10000?budget.intersectionMeters:budget.altitudeMeters)');put('tests/browser/validate.js',s)
