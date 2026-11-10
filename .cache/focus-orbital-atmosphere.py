from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
f=root/'webgpu/camera.ts';s=f.read_text(encoding='utf-8').replace('origin: EcefVector, width: number)','origin: EcefVector, width: number, top = 0)')
s=s.replace('    const horizon = new Float32Array(width);','    const horizon = new Float32Array(width);\n    const upperHorizon = new Float32Array(width).fill(Math.PI/2);')
s=s.replace('        horizon[x] = (low + high) / 2;','''        horizon[x] = (low + high) / 2;
        if (top > 0 && geo.height >= top) {
            low = -Math.PI/2; high = 0;
            for (let k=0;k<48;k++) {
                const elevation=(low+high)/2;
                const d=up.map((v,i)=>v*Math.sin(elevation)+Math.cos(elevation)*(Math.cos(azimuth)*east[i]+Math.sin(azimuth)*north[i]));
                const hit=intersectEllipsoid(axes,origin,d,1+top/axes.semiMinorAxis);
                if(hit && hit[0]>=0)low=elevation;else high=elevation;
            }
            upperHorizon[x]=(low+high)/2;
        }''').replace('up, horizon, height:','up, horizon, upperHorizon, height:');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'webgpu/index.ts';s=f.read_text(encoding='utf-8').replace('new Float32Array(this.width), GPUBufferUsage.STORAGE','new Float32Array(this.width * 2), GPUBufferUsage.STORAGE').replace('next.positionEcefMeters, this.width);','next.positionEcefMeters, this.width, this.model.top);').replace('this.horizon = metadata.horizon;','this.horizon = new Float32Array(this.width * 2);\n        this.horizon.set(metadata.horizon);\n        this.horizon.set(metadata.upperHorizon, this.width);');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'webgpu/shaders/bake.wgsl';s=f.read_text(encoding='utf-8').replace('let span=select(0.5*atmosphere_PI-h,h+0.5*atmosphere_PI,ground);','let span=select(atmosphere_horizon[atmosphere_frame.size.x+id.x]-h,h+0.5*atmosphere_PI,ground);').replace('span*fraction*fraction*fraction*fraction;','span*select(fraction*fraction*fraction*fraction,fraction*fraction,atmosphere_frame.quality.z==1u && !ground);');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'webgpu/shaders/read.wgsl';s=f.read_text(encoding='utf-8');start=s.index('fn atmosphere_horizonAt');end=s.index('fn atmosphere_skyUv',start)
s=s[:start]+'''fn atmosphere_horizonPair(u:f32)->vec2f {
    let width=arrayLength(&atmosphere_horizon)/2u;let x=fract(u)*f32(width);let left=u32(floor(x));let right=(left+1u)%width;
    return mix(vec2f(atmosphere_horizon[left%width],atmosphere_horizon[width+left%width]),vec2f(atmosphere_horizon[right],atmosphere_horizon[width+right]),fract(x));
}
fn atmosphere_horizonAt(u:f32)->f32 {return atmosphere_horizonPair(u).x;}
'''+s[end:]
s=s.replace('let h=atmosphere_horizonAt(azimuth);','let bounds=atmosphere_horizonPair(azimuth);let h=bounds.x;').replace('select(0.5*atmosphere_PI-h,h+0.5*atmosphere_PI,ground)','select(bounds.y-h,h+0.5*atmosphere_PI,ground)').replace('var t=sqrt(sqrt(clamp(abs(elevation-h)/max(span,1e-6),0.0,1.0)));','let fraction=clamp(abs(elevation-h)/max(span,1e-6),0.0,1.0);var t=select(sqrt(sqrt(fraction)),sqrt(fraction),atmosphere_frame.quality.z==1u && !ground);')
s+='''
// RGB approximation normalized to the incident spectrum's white point. Vacuum is exactly one.
fn atmosphere_skyTransmission(directionEcef:vec3f)->vec3f {
    let uv=atmosphere_skyUv(normalize(directionEcef));var xyz=vec3f(0.0);var white=vec3f(0.0);
    for(var g=0u;g<arrayLength(&atmosphere_spectrum);g++) {
        let band=atmosphere_spectrum[g];let input=band.atmosphere_solar.xyz;
        xyz+=atmosphere_toXYZ(textureSampleLevel(atmosphere_transmission,atmosphere_sampler,uv,i32(g),0.0).xyz*input,band);
        white+=atmosphere_toXYZ(input,band);
    }
    return clamp(atmosphere_xyzToRgb(xyz)/max(atmosphere_xyzToRgb(white),vec3f(1e-6)),vec3f(0.0),vec3f(1.0));
}
''';f.write_text(s,encoding='utf-8',newline='\n')
print('Focused orbital sky sampling on the physical limb instead of empty sky.')
