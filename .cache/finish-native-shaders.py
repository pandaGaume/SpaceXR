from pathlib import Path
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=r/'packages/core/src/terrain/gpu/shaders/wgsl/instancedGrid.fragment.wgsl';s=p.read_text(encoding='utf-8').replace('// TERRAIN_FRAGMENT_COLOR','#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR');p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/src/atmosphere/native-surface.ts';s=p.read_text(encoding='utf-8').replace('// TERRAIN_FRAGMENT_COLOR','#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR');p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/tests/sky-motion.test.ts';s=p.read_text(encoding='utf-8');s=s[s.index('import { beforeEach'):];s=s.replace('    compositorExposures: [] as number[],\n','').replace('    state.compositorExposures.length = 0;\n','');a=s.index('    it("uses the same HDR exposure');b=s.index('    it("never draws',a)
s=s[:a]+'''    it("keeps sky exposure stable before and after an explicit update without scene post-processes",async()=>{
        const {scene,camera,device}=fixture();const sky=await BabylonEarthSky.create(scene,makePhysicalScene({dustTau:0},[1,0,0]).model,{exposure:4});
        for(let i=0;i<6;i++)await sky.update(camera);
        expect((device.queue.writeBuffer.mock.calls.at(-1)![2] as Float32Array)[14]).toBe(4);
        sky.setExposure(4);await sky.update(camera);
        expect((device.queue.writeBuffer.mock.calls.at(-1)![2] as Float32Array)[14]).toBe(4);sky.dispose();
    });
'''+s[b:];p.write_text(s,encoding='utf-8')
