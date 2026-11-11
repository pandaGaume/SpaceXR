from pathlib import Path
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
p=a/'webgpu/types.ts';s=p.read_text(encoding='utf-8').replace('    /** Resolved spectral wavelength count. */','    /** Isotropic higher-order spectral radiance per incident irradiance; absent when disabled. */\n    readonly multipleRadiance?: GPUTextureView;\n    /** Resolved spectral wavelength count. */');p.write_text(s,encoding='utf-8')
p=a/'webgpu/index.ts';s=p.read_text(encoding='utf-8').replace('                wavelengths: this.wavelengths,','                wavelengths: this.wavelengths,\n                ...(this.multipleScattering ? {multipleRadiance:multipleView} : {}),');p.write_text(s,encoding='utf-8')
(a/'tests/browser/multiple.js').write_text(Path('.cache/multiple-test.js').read_text(encoding='utf-8'),encoding='utf-8')
p=a/'tests/browser/validate.js';s=p.read_text(encoding='utf-8');s='import {validateMultiple} from "./multiple.js";\n'+s;s=s.replace('        report.aerial = await validateAerial(device);','        report.multiple = await validateMultiple(device);\n        failures.push(...report.multiple.failures);\n        report.aerial = await validateAerial(device);');p.write_text(s,encoding='utf-8')
(a/'tests/absorption.test.ts').write_text('''import {describe,it,expect} from "vitest";
import {createAtmosphereLayer,layerDensityAtAltitude,makePhysicalScene,makeSpectralScene,LayeredAtmosphere,integrateSpectral} from "../src";
const profile={kind:"tent" as const,bottomAltitudeMeters:10000,topAltitudeMeters:40000,referenceAltitudeMeters:25000,scaleHeightMeters:15000,densityScale:1};
describe("spectral absorption layers",()=>{
    it("preserves a tent's reference density and integrated column",()=>{
        expect(layerDensityAtAltitude(profile,10000)).toBe(0);expect(layerDensityAtAltitude(profile,25000)).toBe(1);expect(layerDensityAtAltitude(profile,40000)).toBe(0);
        let column=0;for(let h=0;h<50000;h+=100)column+=100*layerDensityAtAltitude(profile,h+50);expect(column).toBeCloseTo(15000,8);
    });
    it("interpolates cross sections without producing scattered light and snapshots its table",()=>{
        const table:[number,number][]=[[400,1e-25],[600,3e-25],[800,0]];
        const layer=createAtmosphereLayer({id:"absorber",kind:"absorption",profile,absorption:{numberDensityPerM3:1e18,crossSections:table}});
        table[0][1]=0;expect(layer.optics(400).extinction).toBeCloseTo(1e-7,12);expect(layer.optics(500).extinction).toBeCloseTo(2e-7,12);
        expect(layer.optics(500).rayleigh).toBe(0);expect(layer.optics(500).scattering).toBe(0);expect(layer.optics(900).extinction).toBe(0);
        const base=makePhysicalScene({pressure:0,dustTau:0},[1,0,0]).model;
        const model=new LayeredAtmosphere({...base,layers:[layer]});const scene=makeSpectralScene(model);
        const eye=[model.ellipsoid.semiMajorAxis+1,0,0];const result=integrateSpectral(scene,eye,[1,0,0],{steps:1000,solarSteps:8});
        expect(result.spectralRadiance.every(v=>v===0)).toBe(true);
        const vacuum=integrateSpectral(scene,eye,[1,0,0],{maxDistanceMeters:0});expect(result.transmittance.every((v,i)=>v<vacuum.transmittance[i])).toBe(true);
        expect(scene.report.layers[0].absorption?.crossSections).toBeDefined();
    });
    it("rejects invalid spectral tables",()=>{
        for(const crossSections of [[[500,1],[400,1]],[[400,-1],[500,0]],[[400,NaN],[500,0]]])
            expect(()=>createAtmosphereLayer({id:"bad",kind:"absorption",profile,absorption:{numberDensityPerM3:1,crossSections:crossSections as [number,number][]}})).toThrow(/Absorption/);
    });
});
''',encoding='utf-8')
