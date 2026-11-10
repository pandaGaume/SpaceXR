struct atmosphere_AerialCamera {forward:vec4f,right:vec4f,up:vec4f,size:vec4u}
@group(1) @binding(0) var<uniform> aerialCamera:atmosphere_AerialCamera;
@group(1) @binding(1) var aerialLight:texture_storage_3d<rgba16float,write>;
@group(1) @binding(2) var aerialTransmission:texture_storage_3d<rgba16float,write>;
@compute @workgroup_size(8,4,1)
fn atmosphere_bakeAerial(@builtin(global_invocation_id) id:vec3u) {
    if any(id.xy>=aerialCamera.size.xy) {return;}
    let uv=vec2f(id.xy)/vec2f(aerialCamera.size.xy-vec2u(1));
    let direction=normalize(aerialCamera.forward.xyz+(2.0*uv.x-1.0)*aerialCamera.right.w*aerialCamera.right.xyz+(1.0-2.0*uv.y)*aerialCamera.up.w*aerialCamera.up.xyz);
    let interval=atmosphere_interval(atmosphere_cameraPoint(),direction);
    var light:array<vec3f,16>;var transmission:array<vec3f,16>;
    let groups=arrayLength(&atmosphere_spectrum);var whiteXYZ=vec3f(0.0);
    for(var group=0u;group<groups;group++) {transmission[group]=vec3f(1.0);let band=atmosphere_spectrum[group];whiteXYZ+=atmosphere_toXYZ(band.atmosphere_solar.xyz,band);}
    let whiteRGB=max(atmosphere_xyzToRgb(whiteXYZ),vec3f(1e-6));
    for(var z=0u;z<aerialCamera.size.z;z++) {
        var xyz=vec3f(0.0);var transXYZ=vec3f(0.0);
        for(var group=0u;group<groups;group++) {
            if z>0u && interval.y>interval.x {
                let start=mix(interval.x,interval.y,f32(z-1u)/f32(aerialCamera.size.z-1u));
                let end=mix(interval.x,interval.y,f32(z)/f32(aerialCamera.size.z-1u));
                let result=atmosphere_integrateRange(direction,group,vec2f(start,end),0,i32(aerialCamera.forward.w));
                light[group]+=transmission[group]*result.light;transmission[group]*=result.transmission;
            }
            let band=atmosphere_spectrum[group];
            xyz+=atmosphere_toXYZ(light[group]*band.atmosphere_solar.xyz,band);
            transXYZ+=atmosphere_toXYZ(transmission[group]*band.atmosphere_solar.xyz,band);
        }
        textureStore(aerialLight,vec3i(i32(id.x),i32(id.y),i32(z)),vec4f(max(atmosphere_xyzToRgb(xyz),vec3f(0.0)),1.0));
        textureStore(aerialTransmission,vec3i(i32(id.x),i32(id.y),i32(z)),vec4f(clamp(atmosphere_xyzToRgb(transXYZ)/whiteRGB,vec3f(0.0),vec3f(1.0)),1.0));
    }
}
