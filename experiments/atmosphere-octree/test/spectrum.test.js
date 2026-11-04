import {geodeticPosition} from '../src/geometry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mieSphere,dustOptics} from '../src/mie.js';
import {mixtureOptics,planckIrradiance,cieXYZ,xyzToLinearRgb,makePhysicalScene,physicalPresets,spectrumBuffer,integrateSpectral} from '../src/spectrum.js';
import {solarSignature} from '../src/solar-lut.js';
const close=(a,b,epsilon)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
test('Mie matches reference nonabsorbing and absorbing sphere efficiencies',()=>{
    const clear=mieSphere(2,1.5),absorbing=mieSphere(2,1.5,.1);
    close(clear.qScattering,1.798418163226264,1e-12);close(clear.qExtinction,clear.qScattering,1e-12);
    close(absorbing.qScattering,1.286167973654895,1e-12);close(absorbing.qExtinction,1.941478433709585,1e-12);
});
test('Mie reaches Rayleigh limit and integrates phase over solid angle to unity',()=>{
    const small=mieSphere(.01,1.5),ratio=(1.5**2-1)/(1.5**2+2),rayleigh=8/3*.01**4*ratio**2;
    close(small.qScattering/rayleigh,1,1e-4);
    for(const sphere of [small,mieSphere(2,1.5,.01),mieSphere(15,1.5,.003)]){
        const n=20000;let integral=0;for(let i=0;i<n;i++)integral+=sphere.phase(-1+2*(i+.5)/n)*4*Math.PI/n;
        close(integral,1,1e-5);
    }
});
test('lognormal dust preserves passivity and number-weighted cross sections',()=>{
    for(const w of [400,550,750]){const d=dustOptics(w,{radiusUm:.7,logSigma:.3,indexN:1.5,indexK:.003});assert.ok(d.scattering>0 && d.extinction>=d.scattering);}
    const r=.2,w=550,s=mieSphere(2*Math.PI*r*1000/w,1.5),d=dustOptics(w,{radiusUm:r,logSigma:0,indexN:1.5,indexK:0});
    close(d.scattering/(Math.PI*(r*1e-6)**2),s.qScattering,1e-12);
});
test('gas scattering obeys ideal gas density, mixture weighting and inverse fourth wavelength law',()=>{
    const b=mixtureOptics({N2:1},1000,200,3,550),p=mixtureOptics({N2:1},2000,200,3,550),w=mixtureOptics({N2:1},1000,200,3,1100);
    close(p.beta/b.beta,2,1e-12);close(b.beta/w.beta,16,1e-12);
    const co=mixtureOptics({CO2:1},1000,200,3,550),mix=mixtureOptics({N2:2,CO2:2},1000,200,3,550);
    close(mix.beta,(b.beta+co.beta)/2,1e-20);assert.ok(co.scaleHeight<b.scaleHeight);
});
test('Planck irradiance follows inverse square distance and stellar spectral temperature',()=>{
    close(planckIrradiance(550,5778,2)/planckIrradiance(550,5778,1),.25,1e-12);
    assert.ok(planckIrradiance(450,8000)/planckIrradiance(700,8000)>planckIrradiance(450,3000)/planckIrradiance(700,3000));
});
test('observer conversion gives green from a 550 nm source without any planet label',()=>{
    const rgb=xyzToLinearRgb(cieXYZ(550));assert.ok(rgb[1]>rgb[0] && rgb[1]>rgb[2]);
});
test('spectral source changes do not change scattering coefficients or column LUT signature',()=>{
    const a=makePhysicalScene({...physicalPresets.mars,wavelengths:24},[.01,1,0]);
    const b=makePhysicalScene({...physicalPresets.mars,wavelengths:24,source:'band',bandCenter:550,bandWidth:40},[.01,1,0]);
    assert.equal(solarSignature(a.model),solarSignature(b.model));
    a.bins.forEach((v,i)=>{assert.equal(v.rayleigh,b.bins[i].rayleigh);assert.equal(v.extinction,b.bins[i].extinction);});
    assert.notEqual(a.bins[0].solar,b.bins[0].solar);assert.equal(spectrumBuffer(a).byteLength,8*112);
});
test('clear atmosphere has exactly zero aerosol optical coefficients and invalid states fail',()=>{
    const clear=makePhysicalScene(physicalPresets.co2,[1,0,0]);assert.ok(clear.bins.every(b=>b.extinction===0&&b.scattering===0));
    assert.throws(()=>makePhysicalScene({...physicalPresets.mars,source:'band',bandCenter:550,bandWidth:40,dustTau:-1},[1,0,0]));
    assert.throws(()=>mixtureOptics({N2:-1},600,210,3.7,550));
});
import { readFileSync } from 'node:fs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/mie-reference.json',import.meta.url),'utf8'));
test('Mie recurrence agrees with independent SciPy Bessel reference, efficiencies and angular phase',()=>{
    for(const value of fixture.cases){
        const sphere=mieSphere(value.x,value.n,value.k);
        close(sphere.qScattering,value.qScattering,1e-10);close(sphere.qExtinction,value.qExtinction,1e-10);
        for(const p of value.phases)close(sphere.phase(p.mu),p.value,Math.max(1e-10,p.value*1e-9));
    }
});

test('single scattering remains after surface sunset and responds to dust altitude',()=>{
    const angle=-6*Math.PI/180,sun=[Math.sin(angle),Math.cos(angle),0];
    const low=makePhysicalScene(physicalPresets.mars,sun),high=makePhysicalScene({...physicalPresets.mars,dustHeight:20000},sun);
    const origin=geodeticPosition(low.model.ellipsoid,0,0,2),look=.5*Math.PI/180,direction=[Math.sin(look),Math.cos(look),0];
    assert.deepEqual(low.model.solarTransmittance(origin),[0,0,0]);
    const a=integrateSpectral(low,origin,direction),b=integrateSpectral(high,origin,direction);
    assert.ok(a.spectralRadiance.some(v=>v>0));
    const luminance=(scene,value)=>scene.bins.reduce((sum,bin,i)=>sum+bin.xyz[1]*bin.solar*value.spectralRadiance[i],0);
    assert.ok(luminance(high,b)>luminance(low,a));
});
test('deep night has no emission in the single-scattering model',()=>{
    const scene=makePhysicalScene(physicalPresets.mars,[-1,0,0]),origin=geodeticPosition(scene.model.ellipsoid,0,0,2);
    const value=integrateSpectral(scene,origin,[1,0,0]);assert.ok(value.spectralRadiance.every(v=>v===0));
});
