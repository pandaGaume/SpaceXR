from pathlib import Path
import shutil
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere');stage=Path(__file__).parent/'aerial-stage/atmosphere'
for source in stage.rglob('*'):
    if source.is_file():dest=root/source.relative_to(stage);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
f=root/'scripts/build-shaders.mjs';s=f.read_text(encoding='utf-8').replace('"bake", "solar"','"bake", "solar", "aerial"');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'webgpu/index.ts';s=f.read_text(encoding='utf-8');s='import { AtmosphereAerialVolume, type IAtmosphereAerialOptions } from "./aerial";\nexport { AtmosphereAerialVolume } from "./aerial";\nexport type { IAtmosphereAerialOptions, IAtmosphereAerialBindings } from "./aerial";\n'+s
marker='    private assertLive(): void {';s=s.replace(marker,'''    /** Allocates finite-distance transport borrowing this sky's physical snapshot and solar LUT. */
    public createAerialVolume(options: IAtmosphereAerialOptions = {}): Promise<AtmosphereAerialVolume> {
        this.assertLive();
        return AtmosphereAerialVolume.create(this.device, this.readers.layout, () => this.bindings(), options);
    }
'''+marker);f.write_text(s,encoding='utf-8',newline='\n')
f=root/'webgpu/shaders/transport.wgsl';s=f.read_text(encoding='utf-8');s=s.replace('''    var light=vec3f(0.0); var transmission=vec3f(1.0);
''','''    return atmosphere_integrateRange(d,group,segment,tangentSide,i32(atmosphere_frame.quality.x));
}
// Shared finite-segment transport; no renderer-specific approximation of scattering.
fn atmosphere_integrateRange(d:vec3f,group:u32,segment:vec2f,tangentSide:i32,steps:i32)->atmosphere_RayResult {
    let origin=atmosphere_cameraPoint();
    var light=vec3f(0.0); var transmission=vec3f(1.0);
''',1).replace('let count=atmosphere_frame.quality.x; let ds=','let count=u32(steps); let ds=');f.write_text(s,encoding='utf-8',newline='\n')
print('Added renderer-neutral cumulative spectral aerial transport.')
