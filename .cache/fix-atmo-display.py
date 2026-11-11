from pathlib import Path
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
(r/'packages/babylon-earth/src/atmosphere/display-color.ts').write_text('''import {makeSpectralScene,xyzToLinearRgb,type IAtmosphere} from "@spacexr/atmosphere";
import type {IAtmosphereSkyOptions} from "@spacexr/atmosphere/webgpu";
/** Incident-continuum white point, normalized to luminance one, matching neutral scene material RGB. */
export function atmosphereWhitePoint(model:IAtmosphere,quality:IAtmosphereSkyOptions={}):readonly number[]{
    if(quality.source==="band")return [1,1,1];
    const scene=makeSpectralScene(model,quality);const xyz=[0,0,0];
    for(const bin of scene.bins)for(let c=0;c<3;c++)xyz[c]+=bin.solar*bin.xyz[c];
    return xyzToLinearRgb(xyz).map(v=>Math.max(1e-6,v/xyz[1]));
}
''',encoding='utf-8')
p=r/'packages/babylon-earth/src/atmosphere/babylon-sky.ts';s=p.read_text(encoding='utf-8').replace('import { BabylonAtmosphereCompositor }', 'import { atmosphereWhitePoint } from "./display-color";\nimport { BabylonAtmosphereCompositor }');s=s.replace('                    options.exposure ?? 12,','                    bridge.exposure,\n                    atmosphereWhitePoint(model,options.quality),');p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/src/atmosphere/scene-compositor.ts';s=p.read_text(encoding='utf-8').replace('        private exposure: number,','        private exposure: number,\n        private readonly whitePoint:readonly number[],').replace('data.set([this.engine.useReverseDepthBuffer ? 0 : 1, 0, 0, 0], 36);','data.set([this.engine.useReverseDepthBuffer ? 0 : 1, ...this.whitePoint], 36);');p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/src/atmosphere/composite.wgsl';s=p.read_text(encoding='utf-8').replace('return max(atmosphere_skyRadiance(d),vec3f(0.0));','return max(atmosphere_skyRadiance(d),vec3f(0.0))/sceneCamera.options.yzw;').replace('light=textureSampleLevel(aerialRadiance,aerialSampler,coord,0.0).rgb;','light=textureSampleLevel(aerialRadiance,aerialSampler,coord,0.0).rgb/sceneCamera.options.yzw;').replace('color+=max(atmosphere_xyzToRgb(xyz),vec3f(0.0))*disc/', 'color+=max(atmosphere_xyzToRgb(xyz),vec3f(0.0))/sceneCamera.options.yzw*disc/');p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/tests/earth.test.ts';s=p.read_text(encoding='utf-8');s='import {atmosphereWhitePoint} from "../src/atmosphere/display-color";\n'+s;needle='    it("converts Celestial observer directions';s=s.replace(needle,'''    it("supplies a column-conserving reference ozone absorber and a consistent solar white point",()=>{
        const model=earthAtmosphere(new Date("2026-06-21T12:00:00Z"));const ozone=model.layers.find(l=>l.id==="earth-ozone")!;
        expect(ozone.kind).toBe("absorption");expect(ozone.absorption!.numberDensityPerM3*15000).toBeCloseTo(300*2.687e20,-8);
        expect(ozone.optics(600).extinction).toBeGreaterThan(ozone.optics(450).extinction*10);
        expect(ozone.optics(600).rayleigh).toBe(0);expect(ozone.optics(600).scattering).toBe(0);
        const white=atmosphereWhitePoint(model);expect(white.every(v=>v>0&&v<2)).toBe(true);
        expect(0.2126*white[0]+0.7152*white[1]+0.0722*white[2]).toBeCloseTo(1,3);
        expect(atmosphereWhitePoint(model,{source:"band"})).toEqual([1,1,1]);
        expect(earthAtmosphere(new Date("2026-06-21T12:00:00Z"),{layers:[]}).layers).toHaveLength(0);
    });
''' +needle);p.write_text(s,encoding='utf-8')
