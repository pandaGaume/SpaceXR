from pathlib import Path
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=a/'src/layers.ts';s=p.read_text(encoding='utf-8')
s=s.replace('"exponential" | "constant" | "gaussian"','"exponential" | "constant" | "gaussian" | "tent"')
s=s.replace('Exponential scale height or Gaussian standard deviation, metres.', 'Exponential scale height, Gaussian standard deviation or tent half-width, metres.')
s=s.replace('"gas" | "aerosol"','"gas" | "aerosol" | "absorption"')
s=s.replace('    readonly aerosol?: Readonly<IAerosolLayerState>;', '    readonly aerosol?: Readonly<IAerosolLayerState>;\n    /** Optional wavelength-dependent absorbing medium. */\n    readonly absorption?: Readonly<IAbsorptionLayerState>;')
s=s.replace('/** Serializable layer definition', '''/** Spectral absorption cross sections at a stated reference particle density. */
export interface IAbsorptionLayerState {
    /** Reference molecular number density, per cubic metre. */
    readonly numberDensityPerM3: number;
    /** Strictly increasing [wavelength in nm, cross section in square metres] samples. Linear interpolation; zero outside support. */
    readonly crossSections: readonly (readonly [number, number])[];
}
/** Serializable layer definition''')
s=s.replace('    readonly aerosol?: IAerosolLayerState;', '    readonly aerosol?: IAerosolLayerState;\n    /** Required for an absorption-only layer. */\n    readonly absorption?: IAbsorptionLayerState;')
s=s.replace('["exponential", "constant", "gaussian"]', '["exponential", "constant", "gaussian", "tent"]')
s=s.replace('return profile.densityScale * (profile.kind === "constant" ? 1 : Math.exp(profile.kind === "gaussian" ? -0.5 * x * x : -x));', 'return profile.densityScale * (profile.kind === "tent" ? Math.max(0, 1-Math.abs(x)) : profile.kind === "constant" ? 1 : Math.exp(profile.kind === "gaussian" ? -0.5 * x * x : -x));')
needle='    if (\n        definition.kind !== "aerosol"'
assert needle in s
s=s.replace(needle,'''    if (definition.kind === "absorption") {
        const state=definition.absorption;
        if (!state || !Number.isFinite(state.numberDensityPerM3) || state.numberDensityPerM3 < 0 || state.crossSections.length < 2 ||
            state.crossSections.some(([w,c],i,table)=>!Number.isFinite(w)||w<=0||!Number.isFinite(c)||c<0||(i>0&&w<=table[i-1][0])))
            throw new Error("Absorption layer needs a nonnegative density and increasing spectral cross sections");
        const absorption=Object.freeze({numberDensityPerM3:state.numberDensityPerM3,crossSections:Object.freeze(state.crossSections.map(pair=>Object.freeze([...pair] as [number,number])))});
        return Object.freeze({id:definition.id,kind:"absorption" as const,profile,absorption,optics(wavelengthNm:number):ILayerOptics {
            if (!Number.isFinite(wavelengthNm)||wavelengthNm<=0) throw new Error("Invalid absorption wavelength");
            const table=absorption.crossSections;let cross=0;
            if(wavelengthNm>=table[0][0]&&wavelengthNm<=table.at(-1)![0]){
                let i=0;while(i<table.length-2&&table[i+1][0]<wavelengthNm)i++;
                const t=(wavelengthNm-table[i][0])/(table[i+1][0]-table[i][0]);cross=table[i][1]*(1-t)+table[i+1][1]*t;
            }
            return Object.freeze({rayleigh:0,scattering:0,extinction:cross*absorption.numberDensityPerM3,phase:()=>0});
        }});
    }
''' +needle)
s=s.replace('p.kind === "constant" ? 1 : p.kind === "gaussian" ? 2 : 0', 'p.kind === "constant" ? 1 : p.kind === "gaussian" ? 2 : p.kind === "tent" ? 3 : 0')
p.write_text(s,encoding='utf-8')
p=a/'src/spectrum.ts';s=p.read_text(encoding='utf-8').replace('...(l.aerosol ? { aerosol: l.aerosol } : {}),','...(l.aerosol ? { aerosol: l.aerosol } : {}),\n        ...(l.absorption ? { absorption: l.absorption } : {}),');p.write_text(s,encoding='utf-8')
p=a/'webgpu/shaders/transport.wgsl';s=p.read_text(encoding='utf-8');s=s.replace('rho[i]=layer.shape.x*select(exp(select(-x,-0.5*x*x,layer.shape.y>1.5)),1.0,layer.shape.y>0.5&&layer.shape.y<1.5);','rho[i]=layer.shape.x*select(select(exp(select(-x,-0.5*x*x,layer.shape.y>1.5)),1.0,layer.shape.y>0.5&&layer.shape.y<1.5),max(0.0,1.0-abs(x)),layer.shape.y>2.5);');p.write_text(s,encoding='utf-8')
data=[1.18e-27,2.182e-28,2.818e-28,6.636e-28,1.527e-27,2.763e-27,5.52e-27,8.451e-27,1.582e-26,2.316e-26,3.669e-26,4.924e-26,7.752e-26,9.016e-26,1.48e-25,1.602e-25,2.139e-25,2.755e-25,3.091e-25,3.5e-25,4.266e-25,4.672e-25,4.398e-25,4.701e-25,5.019e-25,4.305e-25,3.74e-25,3.215e-25,2.662e-25,2.238e-25,1.852e-25,1.473e-25,1.209e-25,9.423e-26,7.455e-26,6.566e-26,5.105e-26,4.15e-26,4.228e-26,3.237e-26,2.451e-26,2.801e-26,2.534e-26,1.624e-26,1.465e-26,2.078e-26,1.383e-26,7.105e-27]
p=r/'packages/babylon-earth/src/earth-ozone.ts'
p.write_text('''import {createAtmosphereLayer} from "@spacexr/atmosphere";
// O3 at 233 K, 10 nm bin averages of the Bremen reference spectra, as tabulated by
// Eric Bruneton's 2017 atmosphere demonstration. See THIRD-PARTY-NOTICES.md.
const crossSections='''+str(data)+''';
/** Reference Earth ozone column, 300 DU, tent profile from 10 to 40 km peaking at 25 km. */
export function earthOzoneLayer(){
    return createAtmosphereLayer({id:"earth-ozone",kind:"absorption",profile:{kind:"tent",bottomAltitudeMeters:10000,topAltitudeMeters:40000,referenceAltitudeMeters:25000,scaleHeightMeters:15000,densityScale:1},absorption:{numberDensityPerM3:300*2.687e20/15000,crossSections:crossSections.map((cross,i)=>[365+10*i,cross] as const)}});
}
''',encoding='utf-8')
p=r/'packages/babylon-earth/src/earth-model.ts';s=p.read_text(encoding='utf-8').replace('import { makePhysicalScene, type IPhysicalAtmosphereConfig }','import { earthOzoneLayer } from "./earth-ozone";\nimport { LayeredAtmosphere, makePhysicalScene, type IPhysicalAtmosphereConfig }');s=s.replace('    return makePhysicalScene(', '    const base = makePhysicalScene(').replace('    ).model;','    ).model;\n    return options.layers ? base : new LayeredAtmosphere({...base,layers:[...base.layers,earthOzoneLayer()]});');p.write_text(s,encoding='utf-8')
