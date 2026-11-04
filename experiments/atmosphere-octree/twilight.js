import {makePhysicalScene,physicalPresets,integrateSpectral} from './src/spectrum.js';
import {geodeticPosition} from './src/geometry.js';
const radians=degrees=>degrees*Math.PI/180,results=[];
for(const dustHeight of [10000,20000])for(const elevation of [1,-2,-6,-12,-20,-29]) {
    const scene=makePhysicalScene({...physicalPresets.mars,dustHeight,wavelengths:24},[Math.sin(radians(elevation)),Math.cos(radians(elevation)),0]);
    const origin=geodeticPosition(scene.model.ellipsoid,0,0,2),rays=[];
    for(const lookElevation of [.5,3,15,45,89]) {
        const value=integrateSpectral(scene,origin,[Math.sin(radians(lookElevation)),Math.cos(radians(lookElevation)),0]);
        const xyz=[0,0,0];scene.bins.forEach((bin,i)=>bin.xyz.forEach((w,c)=>xyz[c]+=value.spectralRadiance[i]*bin.solar*w));
        rays.push({lookElevationDegrees:lookElevation,normalizedLuminanceY:xyz[1],linearRgb:value.radiance});
    }
    results.push({dustScaleHeightMeters:dustHeight,solarElevationDegrees:elevation,atmosphereTopMeters:scene.model.top,peakSampleLuminanceY:Math.max(...rays.map(r=>r.normalizedLuminanceY)),rays});
}
console.log(JSON.stringify({method:'CPU direct spectral single scattering, 24 wavelengths, 256 view / 96 solar steps. Five rays in the solar vertical plane. Fixed tau550=0.3; only dust scale height changes.',
    note:'Angular experiment, no two-hour duration imposed. Luminance normalized to the reference solar spectrum. Finite atmosphere top and missing multiple scattering limit interpretation of late twilight.',results},null,2));
