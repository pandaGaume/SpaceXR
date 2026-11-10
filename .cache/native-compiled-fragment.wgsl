//#define SHADER_NAME fragment:[object Object]
diagnostic(off, chromium.unreachable_code);
struct FragmentInputs {
  @builtin(position) position : vec4<f32>,
  @builtin(front_facing) frontFacing : bool,
  @location(0) @interpolate(perspective, center) vDrape : vec4f,
  @location(1) @interpolate(perspective, center) vTile : vec2f,
  @location(2) @interpolate(perspective, center) vPage : vec4f,
  @location(3) @interpolate(perspective, center) vUp : vec3f,
  @location(4) @interpolate(perspective, center) vEast : vec3f,
  @location(5) @interpolate(perspective, center) vSouth : vec3f,
  @location(6) @interpolate(perspective, center) vEdgeN : vec4f,
  @location(7) @interpolate(perspective, center) vEdgeE : vec4f,
  @location(8) @interpolate(perspective, center) vEdgeS : vec4f,
  @location(9) @interpolate(perspective, center) vEdgeW : vec4f,
};
var<private> fragmentInputs : FragmentInputs;
struct FragmentOutputs {
  @location(0) color : vec4<f32>,
};
var<private> fragmentOutputs : FragmentOutputs;

struct LeftOver {
  viewProjection : mat4x4f,
  bodyRotation : mat4x4f,
  cells : f32,
  verticalScale : f32,
  semiMajorAxis : f32,
  eccentricitySquared : f32,
  baseColor : vec3f,
  sunDirection : vec3f,
  sunColor : vec3f,
  skyDirection : vec3f,
  skyColor : vec3f,
  groundColor : vec3f,
  earthAtmoViewport : vec4f,
  earthAtmoOrigin : vec4f,
  earthAtmoInverseAxes : vec4f,
  earthAtmoForward : vec4f,
  earthAtmoRight : vec4f,
  earthAtmoUp : vec4f,
  earthAtmoWhite : vec3f,
  earthAtmoInverseProjection : mat4x4f,
};
@group(1) @binding(6) var<uniform> uniforms : LeftOver;
const RUNTIME_SELECTION = true;
const SCENE_LINEAR_COLOR = true;
const NATIVE_ATMOSPHERE = true;
const INSTANCES = true;
const THIN_INSTANCES = true;
const NUM_BONE_INFLUENCERS = 0;
const NUM_MORPH_INFLUENCERS = 0;
const IS_NDC_HALF_ZRANGE = true;
struct Internals {
yFactor_: f32,
textureOutputHeight_: f32,
};
@group(1) @binding(5) var<uniform> internals : Internals;










@group(1) @binding(0) var elevations: texture_2d_array<f32>;








fn sampleGradient(sample: vec2i, layer: i32) -> vec2f {
let p = sample + vec2i(1);
let west = textureLoad(elevations, p - vec2i(1, 0), layer, 0).r;
let east = textureLoad(elevations, p + vec2i(1, 0), layer, 0).r;
let north = textureLoad(elevations, p - vec2i(0, 1), layer, 0).r;
let south = textureLoad(elevations, p + vec2i(0, 1), layer, 0).r;
return 0.5 * vec2f(east - west, south - north);
}
fn heightGradient(page: vec4f, tile: vec2f) -> vec2f {
if (page.w < 0.0) { return vec2f(0.0);
}
let last = i32(textureDimensions(elevations, 0).x) - 3;
let turns = i32(fract(page.w + 0.125) * 4.0);
var uv = tile;
if (turns == 1) { uv = vec2f(1.0 - tile.y, tile.x);
}
else if (turns == 2) { uv = vec2f(1.0 - tile.x, 1.0 - tile.y);
}
else if (turns == 3) { uv = vec2f(tile.y, 1.0 - tile.x);
}
let texel = (page.xy + uv * page.z) * f32(last);
let base = clamp(vec2i(floor(texel)), vec2i(0), vec2i(last - 1));
let f = clamp(texel - vec2f(base), vec2f(0.0), vec2f(1.0));
let layer = i32(floor(page.w + 0.125));
let top = mix(sampleGradient(base, layer), sampleGradient(base + vec2i(1, 0), layer), f.x);
let bottom = mix(sampleGradient(base + vec2i(0, 1), layer), sampleGradient(base + vec2i(1, 1), layer), f.x);
var gradient = mix(top, bottom, f.y) * page.z * f32(last) * uniforms.verticalScale;
if (turns == 1) { gradient = vec2f(gradient.y, -gradient.x);
}
else if (turns == 2) { gradient = -gradient;
}
else if (turns == 3) { gradient = vec2f(-gradient.y, gradient.x);
}
return gradient;
}
fn joinedGradient(uv: vec2f) -> vec2f {
let page = fragmentInputs.vPage;
var gradient = heightGradient(page, uv);
let width = 1.0 / uniforms.cells;
let edgeN = fragmentInputs.vEdgeN;
let edgeE = fragmentInputs.vEdgeE;
let edgeS = fragmentInputs.vEdgeS;
let edgeW = fragmentInputs.vEdgeW;
if (uv.y < width && edgeN.w >= 0.0 && abs(edgeN.w - page.w) > 0.125) {
gradient = mix(heightGradient(edgeN, uv), gradient, smoothstep(0.0, width, uv.y));
}
if (1.0 - uv.x < width && edgeE.w >= 0.0 && abs(edgeE.w - page.w) > 0.125) {
gradient = mix(heightGradient(edgeE, uv), gradient, smoothstep(0.0, width, 1.0 - uv.x));
}
if (1.0 - uv.y < width && edgeS.w >= 0.0 && abs(edgeS.w - page.w) > 0.125) {
gradient = mix(heightGradient(edgeS, uv), gradient, smoothstep(0.0, width, 1.0 - uv.y));
}
if (uv.x < width && edgeW.w >= 0.0 && abs(edgeW.w - page.w) > 0.125) {
gradient = mix(heightGradient(edgeW, uv), gradient, smoothstep(0.0, width, uv.x));
}
return gradient;
}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {  fragmentInputs = input;
  
            if (internals.yFactor_ == 1.) {
                fragmentInputs.position.y = internals.textureOutputHeight_ - fragmentInputs.position.y;
            }
        
var albedo = uniforms.baseColor;
var normal: vec3f;
let up = normalize(fragmentInputs.vUp);
let gradient = joinedGradient(fragmentInputs.vTile);
normal = normalize(cross(fragmentInputs.vEast + up * gradient.x, -(fragmentInputs.vSouth + up * gradient.y)));
let light = uniforms.sunColor * max(dot(normal, uniforms.sunDirection), 0.0)
+ mix(uniforms.groundColor, uniforms.skyColor, 0.5 * dot(normal, uniforms.skyDirection) + 0.5);
var surfaceColor = albedo * light;
surfaceColor = earthAtmosphereSurface(surfaceColor, fragmentInputs.position);
fragmentOutputs.color = vec4f(surfaceColor, 1.0);
}
fn atmosphere_aerialDepth(origin:vec3f,ray:vec3f,scale:f32,distance:f32)->f32 {
let a=dot(ray,ray);
let b=dot(origin,ray);
let c=dot(origin,origin)-scale*scale;
let delta=b*b-a*c;
if delta<0.0{return 0.0;
}
let root=sqrt(max(0.0,delta));
let start=max(0.0,(-b-root)/a);
let end=(-b+root)/a;
if end<=start{return 0.0;
}return sqrt(clamp((distance-start)/(end-start),0.0,1.0));
}
@group(1) @binding(1) var earthAerialLight: texture_3d<f32>;
@group(1) @binding(3) var earthAerialLightSampler: sampler;
@group(1) @binding(2) var earthAerialTransmission: texture_3d<f32>;
@group(1) @binding(4) var earthAerialTransmissionSampler: sampler;








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
let linear=max(surface*uniforms.earthAtmoViewport.w*transmission+light,vec3f(0.0));
let mapped=vec3f(1.0)-exp(-linear*uniforms.earthAtmoViewport.z);
return select(1.055*pow(mapped,vec3f(1.0/2.4))-vec3f(0.055),12.92*mapped,mapped<=vec3f(0.0031308));
  return fragmentOutputs;
}