import { solarLutSampling } from './solar-lut.wgsl.js';

export const viewStruct = `
struct SkyView {
    east: vec4f, north: vec4f, up: vec4f,
    forward: vec4f, right: vec4f, cameraUp: vec4f,
    display: vec4f, options: vec4f, ground: vec4f,
}
@group(0) @binding(5) var<uniform> view: SkyView;
@group(0) @binding(8) var<storage, read> horizon: array<f32>;
`;
export const skyMapping = `
fn skyDirection(azimuth: f32, elevation: f32) -> vec3f {
    return normalize(sin(elevation) * view.up.xyz + cos(elevation) * (cos(azimuth) * view.east.xyz + sin(azimuth) * view.north.xyz));
}
fn horizonAt(azimuth: f32) -> f32 {
    let count = arrayLength(&horizon); let x = fract(azimuth) * f32(count);
    let left = u32(floor(x));
    return mix(horizon[left % count], horizon[(left + 1u) % count], fract(x));
}
fn skyCoordinates(d: vec3f, ground: bool, size: vec2u) -> vec2f {
    let east = dot(d, view.east.xyz); let north = dot(d, view.north.xyz);
    let azimuth = fract(atan2(north, east) / (2.0 * PI) + 1.0);
    let elevation = atan2(dot(d, view.up.xyz), length(vec2f(east, north)));
    let h = horizonAt(azimuth); let rows = f32(size.y / 2u);
    let span = select(0.5 * PI - h, h + 0.5 * PI, ground);
    let t = sqrt(clamp(abs(elevation - h) / max(span, 1e-6), 0.0, 1.0));
    return vec2f(azimuth + 0.5 / f32(size.x), (select(0.0, rows, ground) + t * (rows - 1.0) + 0.5) / f32(size.y));
}
`;
/** One coordinate solve supplies density and the geographic solar lookup. */
export const mediumCoordinates = `
fn mediumCoordinates(p: vec3f) -> vec3f {
    let a = params.axesTop.x; let b = params.axesTop.y;
    let q = p / vec3f(a, a, b);
    if dot(q, q) < 1.0 { return vec3f(0.0, 0.0, -1.0); }
    let radial = length(p.xy); let e2 = 1.0 - b * b / (a * a);
    var latitude = atan2(p.z, radial * (1.0 - e2));
    for (var i = 0u; i < 12u; i++) {
        let s = sin(latitude); let n = a / sqrt(1.0 - e2 * s * s);
        let next = atan2(p.z + e2 * n * s, radial);
        if abs(next - latitude) < 1e-7 { latitude = next; break; }
        latitude = next;
    }
    let s = sin(latitude);
    let height = max(0.0, radial * cos(latitude) + p.z * s - a * sqrt(1.0 - e2 * s * s));
    return vec3f(latitude, atan2(p.y, p.x), height);
}
`;
// Reuse the validated solar lookup, but supply the already evaluated geographic coordinates.
export const solarAtCoordinates = solarLutSampling
    .replace('fn lutSolar(p: vec3f)', 'fn solarAtCoordinates(p: vec3f, geo: vec3f)')
    .replace('let h = altitude(p);', 'let h = geo.z;')
    .replace(/    let radial = length\(p.xy\);[\s\S]*?    let longitude = atan2\(p.y, p.x\) - atan2\(params.sun.y, params.sun.x\);/, '    let latitude = geo.x;\n    let longitude = geo.y - atan2(params.sun.y, params.sun.x);');

export const bakeSkyView = `
@group(0) @binding(1) var rayleighOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var mieOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var transmissionOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(9) var<storage, read_write> cameraSun: vec4f;
fn sampleDistance(u: f32, start: f32, end: f32, closest: f32) -> f32 {
    let fraction = (closest - start) / max(end - start, 1e-6);
    if fraction > 1e-6 && u < fraction {
        let x = 1.0 - u / fraction;
        return closest - (closest - start) * x * x;
    }
    let x = (u - fraction) / max(1.0 - fraction, 1e-6);
    return closest + (end - closest) * x * x;
}
fn buildSky(id: vec3u, fromSpace: bool) {
    let size = textureDimensions(rayleighOut);
    if any(id.xy >= size) { return; }
    let rows = size.y / 2u; let groundSide = id.y >= rows;
    let t = f32(id.y % rows) / f32(rows - 1u);
    let h = horizon[id.x]; let span = select(0.5 * PI - h, h + 0.5 * PI, groundSide);
    var elevation = h + select(1.0, -1.0, groundSide) * span * t * t;
    if id.y % rows == 0u { elevation += select(1e-5, -1e-5, groundSide); }
    let d = skyDirection(f32(id.x) / f32(size.x) * 2.0 * PI, elevation);
    let o = params.origin.xyz;
    if id.x == 0u && id.y == 0u { cameraSun = vec4f(solarAtCoordinates(o, mediumCoordinates(o)), 1.0); }
    let hit = intersect(o, d, 1.0 + params.axesTop.z / params.axesTop.y);
    let start = select(0.0, max(0.0, hit.x), fromSpace); var end = hit.y;
    let ground = intersect(o, d, 1.0);
    if ground.x >= 0.0 && ground.y >= 0.0 { end = min(end, ground.x); }
    var rayleighLight = vec3f(0.0); var mieLight = vec3f(0.0); var transmission = vec3f(1.0);
    if end > start {
        let axes = vec3f(params.axesTop.x, params.axesTop.x, params.axesTop.y);
        let q = o / axes; let v = d / axes;
        let closest = clamp(-dot(q, v) / dot(v, v), start, end);
        let count = u32(view.options.x);
        for (var i = 0u; i < count; i++) {
            let a = sampleDistance(f32(i) / f32(count), start, end, closest);
            let b = sampleDistance(f32(i + 1u) / f32(count), start, end, closest);
            let ds = b - a;
            let p = o + d * (0.5 * (a + b)); let geo = mediumCoordinates(p);
            if geo.z >= 0.0 && geo.z <= params.axesTop.z {
                let rho = exp(-geo.z / params.mie.zw); let ext = extinction(rho);
                let solar = solarAtCoordinates(p, geo); let stepT = exp(-ext * ds);
                var weight = vec3f(ds);
                for (var c = 0u; c < 3u; c++) { if ext[c] > 1e-7 { weight[c] = (1.0 - stepT[c]) / ext[c]; } }
                rayleighLight += transmission * solar * params.rayleigh.xyz * rho.x * weight;
                mieLight += transmission * solar * params.mie.x * rho.y * weight;
                transmission *= stepT;
            }
        }
    }
    textureStore(rayleighOut, vec2i(id.xy), vec4f(rayleighLight, 1.0));
    textureStore(mieOut, vec2i(id.xy), vec4f(mieLight, 1.0));
    textureStore(transmissionOut, vec2i(id.xy), vec4f(transmission, 1.0));
}
@compute @workgroup_size(8, 4, 1) fn main_inside(@builtin(global_invocation_id) id: vec3u) { buildSky(id, false); }
@compute @workgroup_size(8, 4, 1) fn main_space(@builtin(global_invocation_id) id: vec3u) { buildSky(id, true); }
`;
export const skyReadBindings = `
@group(0) @binding(1) var rayleighSky: texture_2d<f32>;
@group(0) @binding(2) var mieSky: texture_2d<f32>;
@group(0) @binding(3) var transmissionSky: texture_2d<f32>;
@group(0) @binding(4) var skySampler: sampler;
`;
export const skyRadiance = `
fn reconstructedSky(d: vec3f, ground: bool) -> vec3f {
    let uv = skyCoordinates(d, ground, textureDimensions(rayleighSky));
    let mu = dot(d, params.sun.xyz); let g = 0.8;
    let phaseR = 3.0 * (1.0 + mu * mu) / (16.0 * PI);
    let phaseM = 3.0 * (1.0 - g * g) * (1.0 + mu * mu) / (8.0 * PI * (2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
    return textureSampleLevel(rayleighSky, skySampler, uv, 0.0).xyz * phaseR + textureSampleLevel(mieSky, skySampler, uv, 0.0).xyz * phaseM;
}
fn cameraRay(uv: vec2f) -> vec3f {
    return normalize(view.forward.xyz + (2.0 * uv.x - 1.0) * view.right.w * view.right.xyz + (1.0 - 2.0 * uv.y) * view.cameraUp.w * view.cameraUp.xyz);
}
`;
export const presentSky = `
@group(0) @binding(9) var<storage, read> cameraSun: vec4f;
@vertex fn vertexMain(@builtin(vertex_index) id: u32) -> @builtin(position) vec4f {
    let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    return vec4f(positions[id], 0.0, 1.0);
}
@fragment fn fragmentMain(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
    let d = cameraRay(pixel.xy / view.display.xy);
    let hit = intersect(params.origin.xyz, d, 1.0); let ground = hit.x >= 0.0 && hit.y >= 0.0;
    let uv = skyCoordinates(d, ground, textureDimensions(rayleighSky));
    let transmission = textureSampleLevel(transmissionSky, skySampler, uv, 0.0).xyz;
    var color = reconstructedSky(d, ground) + select(vec3f(0.0), view.ground.xyz * transmission, ground);
    // The solar disk is evaluated at native display resolution, outside the Sky-View LUT.
    let separation = length(d - params.sun.xyz);
    let radius = 2.0 * sin(0.5 * view.display.w);
    let edge = max(1e-7, 0.75 * fwidth(separation));
    let disk = 1.0 - smoothstep(radius - edge, radius + edge, separation);
    if !ground && view.options.z > 0.5 { color += cameraSun.xyz * disk * view.options.y; }
    let mapped = pow(vec3f(1.0) - exp(-color * view.display.z), vec3f(1.0 / 2.2));
    let noise = fract(sin(dot(pixel.xy, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
    return vec4f(clamp(mapped + vec3f(noise / 255.0), vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
