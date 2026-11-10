varying vUV:vec2f;
var textureSampler:texture_2d<f32>;
var textureSamplerSampler:sampler;
var earthAtmosphere:texture_2d<f32>;
var earthAtmosphereSampler:sampler;
uniform atmosphereReady:f32;
uniform atmosphereExposure:f32;
@fragment fn main(input:FragmentInputs)->FragmentOutputs {
    if uniforms.atmosphereReady>0.5 {
        fragmentOutputs.color=textureSample(earthAtmosphere,earthAtmosphereSampler,vec2f(input.vUV.x,1.0-input.vUV.y));
    }else {
        let linear=textureSample(textureSampler,textureSamplerSampler,input.vUV).rgb;
        let mapped=vec3f(1.0)-exp(-max(linear,vec3f(0.0))*uniforms.atmosphereExposure);
        fragmentOutputs.color=vec4f(select(1.055*pow(mapped,vec3f(1.0/2.4))-vec3f(0.055),12.92*mapped,mapped<=vec3f(0.0031308)),1.0);
    }
}
