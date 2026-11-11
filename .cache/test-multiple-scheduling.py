from pathlib import Path
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
p=a/'tests/webgpu.test.ts';s=p.read_text(encoding='utf-8');needle='    it("cleans partial creation and reports device loss", async () => {';assert needle in s
s=s.replace(needle,'''    it("spreads higher-order startup work across encodes and never rebuilds it for camera motion",async()=>{
        const g=gpu(),sky=await AtmosphereSky.create(g.device,model,{multipleScattering:true,width:8,hemisphereRows:4,viewSteps:8,solarSteps:8});
        sky.update(camera);let builds=0;while(!sky.encode(g.encoder,4096)){builds++;expect(builds).toBeLessThan(16);}
        expect(builds).toBe(8);const count=()=>g.dispatch.mock.calls.filter(c=>c[0]===4&&c[1]===4).length;
        expect(count()).toBe(8);expect(sky.bindings().multipleRadiance).toBeDefined();
        sky.update({...camera,positionEcefMeters:[6379140,0,0]});expect(sky.encode(g.encoder,4096)).toBe(true);expect(count()).toBe(8);
        expect(g.raw.queue.submit).not.toHaveBeenCalled();sky.dispose();
        expect([...g.buffers,...g.textures].every(r=>r.destroy.mock.calls.length===1)).toBe(true);
    });
'''+needle);p.write_text(s,encoding='utf-8')
p=a/'docs/WEBGPU-INTEGRATION.md';s=p.read_text(encoding='utf-8').replace('It is not rebuilt on camera translation or rotation.', 'At most one higher-order dispatch is encoded per call, even if the requested budget is larger; hosts must submit and continue until `encode` returns true. It is not rebuilt on camera translation or rotation.');p.write_text(s,encoding='utf-8')
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=r/'packages/babylon-earth/README.md';s=p.read_text(encoding='utf-8');s+='''
The HDR compositor and UI use the same initial exposure, including after a date change. Atmospheric radiance is adapted from the computed solar-continuum white point to the neutral RGB convention used by scene materials. The experimental monochromatic source bypasses this white adaptation. This display conversion leaves spectral LUT values and scientific CPU/GPU comparisons unchanged.
''';p.write_text(s,encoding='utf-8')
p=r/'examples/babylon-earth/README.md';s=p.read_text(encoding='utf-8');s+='''
`/orbital.html?view=horizon&sunset=1` places the geometric Sun just above the orbital horizon using Celestial, for inspection of the diffuse blue limb and twilight surface haze. The **Coucher de soleil** button now keeps an orbital camera in orbit. The inside-atmosphere entry retains its Mapzen sunset preset. Earth uses a documented reference ozone column and a precomputed isotropic higher-order scattering table. The default display exposure is identical at startup and after hour changes.
''';p.write_text(s,encoding='utf-8')
