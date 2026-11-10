from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s): (root/n).write_text(s,encoding='utf8')
p=root/'webgpu/index.ts';s=p.read_text().replace('private solarEncoded = false;','private solarCursor=0;\n    private skyCursor=0;')
s=s.replace('this.dirty = true;\n    }','this.dirty = true;\n        this.skyCursor=0;this.encoded=false;\n    }')
start=s.index('    /** Encodes uploads and dirty LUTs.')
end=s.index('    /** Returns stable borrowed reader resources',start)
s=s[:start]+'''    /** Encodes at most maxDispatches construction tasks. Submit before calling again.
     * Returns true when readers may be used downstream of this encoder.
     */
    public encode(encoder:GPUCommandEncoder,maxDispatches=1):boolean {
        this.assertLive();
        if(!Number.isInteger(maxDispatches)||maxDispatches<1||maxDispatches>4096)throw new Error("Invalid atmosphere dispatch budget");
        if(!this.camera||!this.frame||!this.horizon)throw new Error("Update a camera before encoding atmosphere");
        if(!this.dirty)return true;
        for(const upload of this.uploads)upload.destroy();this.uploads.length=0;
        const upload=(data:Float32Array,target:GPUBuffer)=>{const staging=this.device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.COPY_SRC,mappedAtCreation:true});new Float32Array(staging.getMappedRange()).set(data);staging.unmap();encoder.copyBufferToBuffer(staging,0,target,0,data.byteLength);this.uploads.push(staging);};
        upload(this.frame,this.uniform);upload(this.horizon,this.horizonBuffer);
        while(maxDispatches>0&&this.solarCursor<this.solarUniforms.length){
            const slice=this.solarCursor++,data=this.frame.slice();new Uint32Array(data.buffer)[34]=slice;upload(data,this.solarUniforms[slice]);
            const pass=encoder.beginComputePass({label:"Atmosphere solar slice"});pass.setPipeline(this.solarPipeline);pass.setBindGroup(0,this.solarGroups[slice]);pass.dispatchWorkgroups(4,4,1);pass.end();maxDispatches--;
        }
        while(maxDispatches>0&&this.skyCursor<this.bandUniforms.length){
            const task=this.skyCursor++,data=this.frame.slice(),tiles=Math.ceil(this.rows*2/4),integers=new Uint32Array(data.buffer);integers[39]=Math.floor(task/tiles);integers[35]=(task%tiles)*4;upload(data,this.bandUniforms[task]);
            const pass=encoder.beginComputePass({label:"Atmosphere spectral Sky-View tile"});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bandGroups[task]);pass.dispatchWorkgroups(Math.ceil(this.width/8),1,1);pass.end();maxDispatches--;
        }
        this.encoded=this.solarCursor===this.solarUniforms.length&&this.skyCursor===this.bandUniforms.length;this.dirty=!this.encoded;return this.encoded;
    }
'''+s[end:]
put('webgpu/index.ts',s)
s=(root/'tests/webgpu.test.ts').read_text().replace('sky.encode(g.encoder);','sky.encode(g.encoder,4096);');put('tests/webgpu.test.ts',s)
s=(root/'tests/browser/validate.js').read_text()
s=s.replace('const encoder=device.createCommandEncoder();sky.encode(encoder);other.encode(encoder);const read=', '''let ready=false;while(!ready){const construction=device.createCommandEncoder();const a=sky.encode(construction),b=other.encode(construction);ready=a&&b;device.queue.submit([construction.finish()]);await device.queue.onSubmittedWorkDone();}
  const encoder=device.createCommandEncoder();const read=''')
put('tests/browser/validate.js',s)
s=(root/'examples/sky-consumer/main.js').read_text().replace('const c=camera(),encoder=device.createCommandEncoder();sky.update(c);sky.encode(encoder);display??=', '''const c=camera();sky.update(c);let ready=false;while(!ready){const construction=device.createCommandEncoder();ready=sky.encode(construction);device.queue.submit([construction.finish()]);await device.queue.onSubmittedWorkDone();}const encoder=device.createCommandEncoder();display??=''')
put('examples/sky-consumer/main.js',s)
s=(root/'examples/atmosphere-lab/src/public-sky.js').read_text().replace('const start=performance.now(),encoder=this.device.createCommandEncoder();this.sky.update(this.cameraInput());this.sky.encode(encoder);this.display??=','const start=performance.now();this.sky.update(this.cameraInput());let ready=false;while(!ready){const construction=this.device.createCommandEncoder();ready=this.sky.encode(construction);this.device.queue.submit([construction.finish()]);await this.device.queue.onSubmittedWorkDone();}const encoder=this.device.createCommandEncoder();this.display??=')
s=s.replace('this.sky.encode(encoder);this.display.encode','if(!this.sky.encode(encoder)){this.device.queue.submit([encoder.finish()]);return;}this.display.encode')
put('examples/atmosphere-lab/src/public-sky.js',s)
