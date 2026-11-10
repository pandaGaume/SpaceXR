// Isotropic higher-order closure, Hillaire 2020. No ground-reflection contribution.
@group(0) @binding(4) var multipleOut:texture_storage_2d_array<rgba16float,write>;
@compute @workgroup_size(8,4,1)
fn atmosphere_bakeMultiple(@builtin(global_invocation_id) id:vec3u) {
    let size=textureDimensions(multipleOut);
    if any(id.xy>=size) {return;}
    let mu=2.0*f32(id.x)/f32(size.x-1u)-1.0;
    let h=max(0.001,atmosphere_frame.originHi.w*pow(f32(id.y)/f32(size.y-1u),2.0));
    let sun=atmosphere_frame.sun.xyz;
    let side=normalize(cross(sun,select(vec3f(0.0,0.0,1.0),vec3f(0.0,1.0,0.0),abs(sun.z)>0.9)));
    let up=normalize(mu*sun+sqrt(max(0.0,1.0-mu*mu))*side);
    let axes=1.0/atmosphere_frame.inverseHi.xyz;
    let surface=axes*axes*up/length(axes*up);
    let position=surface+h*up;
    let origin=atmosphere_Point(position*atmosphere_frame.inverseHi.xyz,vec3f(0.0));
    let east=normalize(cross(up,select(vec3f(0.0,0.0,1.0),vec3f(0.0,1.0,0.0),abs(up.z)>0.9)));
    let north=cross(up,east);
    let group=atmosphere_frame.size.w;let band=atmosphere_spectrum[group];
    var averageLight=vec3f(0.0);var averageReturn=vec3f(0.0);
    let directions=32u;let steps=24u;
    for(var sample=0u;sample<directions;sample++) {
        let z=1.0-2.0*(f32(sample)+0.5)/f32(directions);
        let phi=f32(sample)*2.39996323;
        let d=z*up+sqrt(max(0.0,1.0-z*z))*(cos(phi)*east+sin(phi)*north);
        let interval=atmosphere_interval(origin,d);
        var t=vec3f(1.0);var light=vec3f(0.0);var returned=vec3f(0.0);
        if interval.y>interval.x {
            for(var step=0u;step<steps;step++) {
                let begin=mix(interval.x,interval.y,pow(f32(step)/f32(steps),2.0));
                let end=mix(interval.x,interval.y,pow(f32(step+1u)/f32(steps),2.0));
                let ds=end-begin;let p=atmosphere_pointAdd(origin,d,(begin+end)*0.5);
                let rho=atmosphere_density(p);let ext=atmosphere_extinction(rho,band);
                var scattering=vec3f(0.0);
                for(var l=0u;l<arrayLength(&atmosphere_profiles);l++){scattering+=rho[l]*(band.layers[l].rayleigh.xyz+band.layers[l].scattering.xyz);}
                let stepT=exp(-ext*ds);var weight=vec3f(ds);
                for(var c=0u;c<3u;c++){if ext[c]>1e-7 {weight[c]=(1.0-stepT[c])/ext[c];}}
                returned+=t*scattering*weight;
                light+=t*scattering*weight*atmosphere_solar(p,band)/(4.0*atmosphere_PI);
                t*=stepT;
            }
        }
        averageLight+=light/f32(directions);averageReturn+=returned/f32(directions);
    }
    // Each wavelength is bounded independently by its integrated scattering return probability.
    let result=averageLight/max(vec3f(1.0)-averageReturn,vec3f(1e-4));
    textureStore(multipleOut,vec2i(id.xy),i32(group),vec4f(result,1.0));
}
