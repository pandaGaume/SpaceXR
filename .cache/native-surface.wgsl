var earthAerialLight: texture_3d<f32>;
var earthAerialLightSampler: sampler;
var earthAerialTransmission: texture_3d<f32>;
var earthAerialTransmissionSampler: sampler;
uniform earthAtmoViewport: vec4f;
uniform earthAtmoOrigin: vec4f;
uniform earthAtmoInverseAxes: vec4f;
uniform earthAtmoForward: vec4f;
uniform earthAtmoRight: vec4f;
uniform earthAtmoUp: vec4f;
uniform earthAtmoWhite: vec3f;
uniform earthAtmoInverseProjection: mat4x4f;
fn earthAtmosphereSurface(surface:vec3f,pixel:vec4f)->vec3f {
    let uv=pixel.xy/uniforms.earthAtmoViewport.xy;
    let view=uniforms.earthAtmoInverseProjection*vec4f(2.0*uv.x-1.0,1.0-2.0*uv.y,pixel.z,1.0);
    let distance=length(view.xyz/view.w)/1000.0;
    let direction=normalize(uniforms.earthAtmoForward.xyz+(2.0*uv.x-1.0)*uniforms.earthAtmoRight.w*uniforms.earthAtmoRight.xyz+(1.0-2.0*uv.y)*uniforms.earthAtmoUp.w*uniforms.earthAtmoUp.xyz);
    let z=atmosphere_aerialDepth(uniforms.earthAtmoOrigin.xyz,direction*uniforms.earthAtmoInverseAxes.xyz,uniforms.earthAtmoOrigin.w,distance);
    let size=vec3f(textureDimensions(earthAerialLight));
    let coord=(vec3f(uv,z)*(size-vec3f(1.0))+vec3f(0.5))/size;
    let light=textureSampleLevel(earthAerialLight,earthAerialLightSampler,coord,0.0).rgb/uniforms.earthAtmoWhite;
    let transmission=textureSampleLevel(earthAerialTransmission,earthAerialTransmissionSampler,coord,0.0).rgb;
    // The ordinary terrain light is retained for a native, identical OFF path; convert its irradiance convention here.
    let linear=max(surface*uniforms.earthAtmoViewport.w*transmission+light,vec3f(0.0));
    let mapped=vec3f(1.0)-exp(-linear*uniforms.earthAtmoViewport.z);
    return select(1.055*pow(mapped,vec3f(1.0/2.4))-vec3f(0.055),12.92*mapped,mapped<=vec3f(0.0031308));
}
