from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
p=root/'webgpu/index.ts';s=p.read_text()
start=s.index('        this.device.pushErrorScope("validation");')
end=s.index('            this.uniform = ',start)
s=s[:start]+'''        const compile=async(code:string,entryPoint:string)=>{
            const module=this.device.createShaderModule({label:entryPoint,code});
            const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==="error");
            if(errors.length)throw new Error(errors.map(m=>`${m.lineNum}: ${m.message}`).join("\\n"));
            return this.device.createComputePipelineAsync({layout:"auto",compute:{module,entryPoint}});
        };
        this.pipeline=await compile(geometry+transport+bake,"atmosphere_bake");
        this.solarPipeline=await compile(geometry+transport+solarBake,"atmosphere_bakeSolar");
        this.device.pushErrorScope("validation");
        try {
'''+s[end:]
start=s.index('            const solarModule = ')
end=s.index('            for (let slice',start)
s=s[:start]+s[end:]
s=s.replace('await sky.initialize(atmosphere, options);\n            return sky;','await sky.initialize(atmosphere, options);\n            sky.assertLive();\n            return sky;')
p.write_text(s,encoding='utf8')
p=root/'tests/webgpu.test.ts';s=p.read_text();idx=s.index('    it("rejects unsupported quality')
s=s[:idx]+'''    it("keeps partial construction unreadable and accepts a newer camera snapshot",async()=>{
        const g=gpu(),sky=await AtmosphereSky.create(g.device,model,{width:8,hemisphereRows:4,viewSteps:8,solarSteps:8});
        const writes=g.raw.queue.writeBuffer.mock.calls.length;
        sky.update(camera);expect(g.raw.queue.writeBuffer).toHaveBeenCalledTimes(writes);
        expect(sky.encode(g.encoder)).toBe(false);expect(()=>sky.bindings()).toThrow(/Encode/);
        sky.update({...camera,positionEcefMeters:[6378140,0,0]});expect(sky.encode(g.encoder,4096)).toBe(true);
        expect(sky.bindings().solarColumns).toBeDefined();sky.dispose();
    });
'''+s[idx:];p.write_text(s,encoding='utf8')
