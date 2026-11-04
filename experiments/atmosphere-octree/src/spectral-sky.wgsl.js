import { viewStruct,skyMapping,solarAtCoordinates,bakeSkyView,skyReadBindings } from './sky-view.wgsl.js';
const bands=`
struct SpectralBand { rayleigh:vec4f, scattering:vec4f, extinction:vec4f, toX:vec4f, toY:vec4f, toZ:vec4f, solar:vec4f }
@group(0) @binding(12) var<storage,read> spectrum:array<SpectralBand>;
var<private> activeBand:SpectralBand;
fn xyzToRgb(v:vec3f)->vec3f {return vec3f(dot(v,vec3f(3.2406,-1.5372,-0.4986)),dot(v,vec3f(-0.9689,1.8758,0.0415)),dot(v,vec3f(0.0557,-0.2040,1.0570)));}
fn toXYZ(v:vec3f,b:SpectralBand)->vec3f {return vec3f(dot(v,b.toX.xyz),dot(v,b.toY.xyz),dot(v,b.toZ.xyz));}
`;
const read=skyReadBindings.replaceAll('texture_2d<f32>','texture_2d_array<f32>');
const reconstruct=`
@group(0) @binding(13) var phaseTexture:texture_2d<f32>;
fn dustPhase(mu:f32,band:u32)->vec3f {
    let n=textureDimensions(phaseTexture).x;
    let x=sqrt(acos(clamp(mu,-1.0,1.0))/PI)*f32(n-1u);let a=u32(floor(x));let b=min(n-1u,a+1u);
    return mix(textureLoad(phaseTexture,vec2i(i32(a),i32(band)),0).xyz,textureLoad(phaseTexture,vec2i(i32(b),i32(band)),0).xyz,fract(x));
}
fn reconstructedXYZ(d:vec3f,ground:bool)->vec3f {
    let uv=skyCoordinates(d,ground,textureDimensions(rayleighSky));let mu=dot(d,params.sun.xyz);
    let phaseR=3.0*(1.0+mu*mu)/(16.0*PI);var xyz=vec3f(0.0);
    for(var i=0u;i<arrayLength(&spectrum);i++) {
        let b=spectrum[i];let r=textureSampleLevel(rayleighSky,skySampler,uv,i32(i),0.0).xyz;
        let m=textureSampleLevel(mieSky,skySampler,uv,i32(i),0.0).xyz;
        xyz+=toXYZ((r*phaseR+m*dustPhase(mu,i))*b.solar.xyz,b);
    }
    return xyz;
}
fn transmissionXYZ(d:vec3f,ground:bool)->vec3f {
    let uv=skyCoordinates(d,ground,textureDimensions(rayleighSky));var xyz=vec3f(0.0);
    for(var i=0u;i<arrayLength(&spectrum);i++){let b=spectrum[i];xyz+=toXYZ(textureSampleLevel(transmissionSky,skySampler,uv,i32(i),0.0).xyz*b.solar.xyz,b);}
    return xyz;
}
fn cameraRay(uv:vec2f)->vec3f {return normalize(view.forward.xyz+(2.0*uv.x-1.0)*view.right.w*view.right.xyz+(1.0-2.0*uv.y)*view.cameraUp.w*view.cameraUp.xyz);}
`;
const presentation=`
@group(0) @binding(9) var<storage,read> cameraSun:array<vec4f>;
@vertex fn vertexMain(@builtin(vertex_index) id:u32)->@builtin(position) vec4f {
    let p=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));return vec4f(p[id],0.0,1.0);
}
@fragment fn fragmentMain(@builtin(position) pixel:vec4f)->@location(0) vec4f {
    let d=cameraRay(pixel.xy/view.display.xy);let hit=intersect(params.origin.xyz,d,1.0);let ground=hit.x>=0.0&&hit.y>=0.0;
    var xyz=reconstructedXYZ(d,ground);
    // Neutral, prelit ground placeholder. No planet-dependent tint.
    if ground {xyz+=transmissionXYZ(d,ground)*0.005;}
    let separation=length(d-params.sun.xyz);let radius=2.0*sin(0.5*view.display.w);
    let edge=max(1e-7,0.75*fwidth(separation));let disk=1.0-smoothstep(radius-edge,radius+edge,separation);
    if !ground && view.options.z>0.5 {
        for(var i=0u;i<arrayLength(&spectrum);i++){let b=spectrum[i];xyz+=toXYZ(cameraSun[i].xyz*b.solar.xyz,b)*disk*view.options.y;}
    }
    // Exposure on luminance preserves chromaticity before the display gamut clamp.
    let mappedXYZ=xyz*((1.0-exp(-max(0.0,xyz.y)*view.display.z))/max(xyz.y,1e-8));
    let rgb=max(vec3f(0.0),xyzToRgb(mappedXYZ));
    let encoded=select(1.055*pow(rgb,vec3f(1.0/2.4))-vec3f(0.055),12.92*rgb,rgb<=vec3f(0.0031308));
    let noise=fract(sin(dot(pixel.xy,vec2f(12.9898,78.233)))*43758.5453)-0.5;
    return vec4f(clamp(encoded+vec3f(noise/255.0),vec3f(0.0),vec3f(1.0)),1.0);
}
`;
export function spectralSkySources(base) {
    const geometry=base.replace('vec3f(params.mie.y * rho.y)','activeBand.extinction.xyz * rho.y').replace('params.rayleigh.xyz * rho.x','activeBand.rayleigh.xyz * rho.x');
    const solar=solarAtCoordinates.replaceAll('params.rayleigh.xyz','activeBand.rayleigh.xyz').replace('vec3f(params.mie.y * columns.y)','activeBand.extinction.xyz * columns.y');
    const bake=bakeSkyView.replaceAll('texture_storage_2d<','texture_storage_2d_array<')
        .replace('cameraSun: vec4f','cameraSun: array<vec4f>')
        .replace('let size = textureDimensions(rayleighOut);','let size = textureDimensions(rayleighOut);\n    if id.z >= arrayLength(&spectrum) { return; }\n    activeBand = spectrum[id.z];')
        .replace('cameraSun = vec4f','cameraSun[id.z] = vec4f')
        .replaceAll('params.rayleigh.xyz','activeBand.rayleigh.xyz').replace('params.mie.x * rho.y','activeBand.scattering.xyz * rho.y')
        .replaceAll('vec2i(id.xy), vec4f','vec2i(id.xy), i32(id.z), vec4f');
    const common=geometry+bands+viewStruct+skyMapping;
    const probe=common+read+reconstruct+`
struct ProbeResult {radiance:vec4f,transmission:vec4f}
@group(0) @binding(10) var<storage,read> rays:array<vec4f>;
@group(0) @binding(11) var<storage,read_write> result:array<ProbeResult>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3u){
    if id.x>=arrayLength(&rays){return;}let d=normalize(rays[id.x].xyz);let hit=intersect(params.origin.xyz,d,1.0);let ground=hit.x>=0.0&&hit.y>=0.0;
    result[id.x]=ProbeResult(vec4f(xyzToRgb(reconstructedXYZ(d,ground)),1.0),vec4f(xyzToRgb(transmissionXYZ(d,ground)),1.0));
}`;
    return {build:geometry+bands+solar+viewStruct+skyMapping+bake,presentation:common+read+reconstruct+presentation,probe};
}
