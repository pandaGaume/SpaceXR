import { WGS84, along, atmosphericInterval, dot, envelopeScale, intersectEllipsoid, normalize } from './geometry.js';
import { Atmosphere } from './model.js';
import { dustOptics } from './mie.js';
export const MARS=Object.freeze({semiMajorAxis:3396200,semiMinorAxis:3376200});
// Polarizability volumes in A^3, experimental NIST CCCBDB values. Static approximation.
export const gases=Object.freeze({N2:{mass:28.0134,alpha:1.710},O2:{mass:31.998,alpha:1.562},CO2:{mass:44.01,alpha:2.507},Ar:{mass:39.948,alpha:1.664}});
export const physicalPresets={
    earth:{planet:'earth',pressure:101325,temperature:288,gravity:9.80665,mix:{N2:78.08,O2:20.95,CO2:0.04,Ar:0.93},dustTau:0.015,dustHeight:1200,radiusUm:0.1,logSigma:0.3,indexN:1.45,indexK:0.003,distanceAU:1},
    mars:{planet:'mars',pressure:636,temperature:210,gravity:3.71,mix:{N2:2.6,O2:0.16,CO2:95,Ar:1.9},dustTau:0.3,dustHeight:10000,radiusUm:0.7,logSigma:0.3,indexN:1.5,indexK:0.003,distanceAU:1.524},
    co2:{planet:'mars',pressure:636,temperature:210,gravity:3.71,mix:{N2:0,O2:0,CO2:100,Ar:0},dustTau:0,dustHeight:10000,radiusUm:0.7,logSigma:0.3,indexN:1.5,indexK:0.003,distanceAU:1.524}
};
export function mixtureOptics(mix,pressure,temperature,gravity,wavelengthNm) {
    const entries=Object.entries(mix);if(entries.some(([gas,x])=>!gases[gas]||!Number.isFinite(x)||x<0))throw new Error('Invalid molecular mixture');
    const sum=entries.reduce((s,[,x])=>s+x,0);
    if(!(sum>0 && pressure>=0 && Number.isFinite(pressure) && temperature>0 && gravity>0 && wavelengthNm>0 && [temperature,gravity,wavelengthNm].every(Number.isFinite)))throw new Error('Invalid gas state');
    const mass=entries.reduce((s,[g,x])=>s+x/sum*gases[g].mass,0);
    const polarizabilitySquared=entries.reduce((s,[g,x])=>s+x/sum*(gases[g].alpha*1e-30)**2,0);
    // sigma = (8*pi/3) * (2*pi/lambda)^4 * alpha_volume^2.
    const crossSection=8*Math.PI/3*(2*Math.PI/(wavelengthNm*1e-9))**4*polarizabilitySquared;
    return {beta:pressure/(1.380649e-23*temperature)*crossSection,scaleHeight:1.380649e-23*temperature/(mass*1.66053906660e-27*gravity),meanMassAmu:mass};
}
export function planckIrradiance(wavelengthNm,temperature=5778,distanceAU=1) {
    const lambda=wavelengthNm*1e-9;
    if(!(lambda>0 && temperature>=1000 && temperature<=20000 && distanceAU>0))throw new Error('Invalid stellar spectrum');
    return 2*6.62607015e-34*299792458**2/lambda**5/Math.expm1(0.01438776877/(lambda*temperature))*Math.PI*(695700000/(distanceAU*149597870700))**2*1e-9;
}
// Wyman, Sloan & Shirley 2013 analytic CIE 1931 observer, no planet-dependent color.
export function cieXYZ(w) {
    const g=(mu,left,right)=>Math.exp(-0.5*((w-mu)*(w<mu?left:right))**2);
    return [1.056*g(599.8,.0264,.0323)+.362*g(442,.0624,.0374)-.065*g(501.1,.049,.0382),
        .821*g(568.8,.0213,.0247)+.286*g(530.9,.0613,.0322),1.217*g(437,.0845,.0278)+.681*g(459,.0385,.0725)];
}
export const xyzToLinearRgb=([x,y,z])=>[3.2406*x-1.5372*y-.4986*z,-.9689*x+1.8758*y+.0415*z,.0557*x-.204*y+1.057*z];
const solarY=Array.from({length:400},(_,i)=>{const w=380+(i+.5);return planckIrradiance(w)*cieXYZ(w)[1];}).reduce((a,b)=>a+b,0);
export function makePhysicalScene(config,sun) {
    const c={...physicalPresets.earth,...config,mix:{...(config.mix??physicalPresets.earth.mix)}};
    const count=c.wavelengths??24;
    if(![24,48].includes(count))throw new Error('Choose 24 or 48 wavelengths');
    if(!(c.dustTau>=0 && c.dustTau<=3 && c.dustHeight>0 && c.distanceAU>0 && ['blackbody','band'].includes(c.source??'blackbody')))throw new Error('Invalid spectral state');
    if(c.source==='band' && !(c.bandCenter>=380 && c.bandCenter<=780 && c.bandWidth>=20 && c.bandWidth<=400))throw new Error('Invalid spectral band');
    const gas=mixtureOptics(c.mix,c.pressure,c.temperature,c.gravity,550),reference=dustOptics(550,c);
    if (!(reference.extinction > 0) && c.dustTau > 0) throw new Error('Nonzero dust optical depth requires a nonzero extinction cross section');
    const numberDensity=c.dustTau===0 ? 0 : c.dustTau/(c.dustHeight*reference.extinction),step=400/count;
    const wavelengths=Array.from({length:count},(_,i)=>380+(i+.5)*step);
    const bins=wavelengths.map(w=>{
        const dust=dustOptics(w,c),rayleigh=mixtureOptics(c.mix,c.pressure,c.temperature,c.gravity,w).beta;
        const input=c.source==='band'?planckIrradiance(c.bandCenter,c.starTemperature??5778,c.distanceAU)*Math.exp(-4*Math.log(2)*((w-c.bandCenter)/c.bandWidth)**2):planckIrradiance(w,c.starTemperature??5778,c.distanceAU);
        return {wavelengthNm:w,rayleigh,scattering:dust.scattering*numberDensity,extinction:dust.extinction*numberDensity,solar:input,xyz:cieXYZ(w).map(v=>v*step/solarY),phase:mu=>dust.phase(mu)};
    });
    const ellipsoid=c.planet==='mars'?MARS:WGS84;
    const model=new Atmosphere({ellipsoid,top:Math.max(100000,gas.scaleHeight*12),rayleighHeight:gas.scaleHeight,mieHeight:c.dustHeight,sun,rayleigh:[gas.beta,gas.beta,gas.beta],mieExtinction:reference.extinction*numberDensity,mieScattering:reference.scattering*numberDensity});
    return {model,bins,config:c,groups:count/3,solarAngularRadius:0.00465047/c.distanceAU,meanMassAmu:gas.meanMassAmu,
        report:{config:c,wavelengthRangeNm:[380,780],wavelengths:count,stepNm:step,meanMassAmu:gas.meanMassAmu,gasScaleHeightMeters:gas.scaleHeight,dustNumberDensityPerM3:numberDensity,
            method:'Spectral single scattering, ideal gas, static molecular polarizabilities, homogeneous-sphere Mie with lognormal radius distribution, Planck or Gaussian illumination, CIE XYZ to linear sRGB. No expected sky color as input.',
            limitations:'Approximate gas polarizability dispersion neglected; no molecular absorption lines, multiple scattering, polarization or non-spherical dust. Dust n,k constant with wavelength are editable experimental assumptions, not measured Mars optical constants.'}};
}
export function spectrumBuffer(scene) {
    const data=[];
    for(let i=0;i<scene.bins.length;i+=3) {
        const b=scene.bins.slice(i,i+3),push=values=>data.push(...values,0);
        for(const key of ['rayleigh','scattering','extinction'])push(b.map(v=>v[key]*1000));
        for(let c=0;c<3;c++)push(b.map(v=>v.xyz[c]));
        push(b.map(v=>v.solar));
    }
    return new Float32Array(data);
}
export function phaseTable(scene,count=512) {
    const data=new Float32Array(count*scene.groups*4);
    for(let i=0;i<scene.groups;i++)for(let x=0;x<count;x++)for(let c=0;c<3;c++) data[(i*count+x)*4+c]=scene.bins[3*i+c].phase(Math.cos(Math.PI*(x/(count-1))**2));
    return {width:count,height:scene.groups,data};
}
/** Independent CPU spectral ray marcher, uses direct solar density columns, not the GPU LUT. */
export function integrateSpectral(scene,origin,direction,{steps=256,solarSteps=96}={}) {
    direction=normalize(direction);
    const m=scene.model,interval=atmosphericInterval(m,origin,direction),n=scene.bins.length,L=Array(n).fill(0),T=Array(n).fill(1);
    const mu=dot(direction,m.sun),phaseR=3*(1+mu*mu)/(16*Math.PI),phase=scene.bins.map(b=>b.phase(mu));
    if(interval) {
        const ds=(interval.end-interval.start)/steps;
        for(let i=0;i<steps;i++) {
            const p=along(origin,direction,interval.start+(i+.5)*ds),rho=m.density(p);
            if(!rho.some(x=>x>0))continue;
            const ground=intersectEllipsoid(m.ellipsoid,p,m.sun),blocked=ground&&ground[1]>1e-4&&ground[0]>=-1e-4;
            const col=[0,0];
            if(!blocked) {
                const end=intersectEllipsoid(m.ellipsoid,p,m.sun,envelopeScale(m.ellipsoid,m.top))?.[1]??0,delta=end/solarSteps;
                for(let j=0;j<solarSteps;j++){const d=m.density(along(p,m.sun,(j+.5)*delta));col[0]+=d[0]*delta;col[1]+=d[1]*delta;}
            }
            for(let j=0;j<n;j++) {
                const b=scene.bins[j],ext=b.rayleigh*rho[0]+b.extinction*rho[1],stepT=Math.exp(-ext*ds),solar=blocked?0:Math.exp(-b.rayleigh*col[0]-b.extinction*col[1]);
                L[j]+=T[j]*solar*(b.rayleigh*rho[0]*phaseR+b.scattering*rho[1]*phase[j])*(ext>0?-Math.expm1(-ext*ds)/ext:ds);T[j]*=stepT;
            }
        }
    }
    const xyz=[0,0,0],transmission=[0,0,0];
    scene.bins.forEach((b,j)=>b.xyz.forEach((w,c)=>{xyz[c]+=L[j]*b.solar*w;transmission[c]+=T[j]*b.solar*w;}));
    return {radiance:xyzToLinearRgb(xyz),transmittance:xyzToLinearRgb(transmission),spectralRadiance:L};
}
