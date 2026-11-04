export const solarLutMapping = `
fn terminatorLongitude(latitude: f32) -> f32 {
    let denominator = max(1e-8, cos(latitude) * sqrt(max(0.0, 1.0 - params.sun.z * params.sun.z)));
    return acos(clamp(-sin(latitude) * params.sun.z / denominator, -cos(0.1), cos(0.1)));
}
fn longitudeFromUnit(u: f32, latitude: f32) -> f32 {
    let center = terminatorLongitude(latitude); let x = 2.0 * u - 1.0;
    if x < 0.0 { return center * (1.0 - x * x); }
    return center + (PI - center) * x * x;
}
fn longitudeToUnit(longitude: f32, latitude: f32) -> f32 {
    let center = terminatorLongitude(latitude);
    let angle = abs((fract(longitude / (2.0 * PI) + 0.5) - 0.5) * 2.0 * PI);
    if angle < center { return 0.5 * (1.0 - sqrt(max(0.0, (center - angle) / center))); }
    return 0.5 + 0.5 * sqrt(max(0.0, (angle - center) / (PI - center)));
}
`;
export const solarLutSampling = solarLutMapping + `
@group(0) @binding(6) var solarTexture: texture_3d<f32>;
@group(0) @binding(7) var solarSampler: sampler;
fn lutSolar(p: vec3f) -> vec3f {
    if blocked(p) { return vec3f(0.0); }
    let axes = vec3f(params.axesTop.x, params.axesTop.x, params.axesTop.y);
    let q = p / axes; let d = params.sun.xyz / axes; let projection = dot(q, d);
    if projection < 0.0 && params.rayleigh.w > 0.0 {
        let closestRadius = sqrt(max(0.0, dot(q, q) - projection * projection / dot(d, d)));
        if params.axesTop.y * (closestRadius - 1.0) < params.rayleigh.w { return directSolar(p); }
    }
    let h = altitude(p);
    if h < 0.0 || h > params.axesTop.z { return directSolar(p); }
    let radial = length(p.xy); let a = params.axesTop.x; let b = params.axesTop.y;
    let e2 = 1.0 - b * b / (a * a);
    var latitude = atan2(p.z, radial * (1.0 - e2));
    for (var i = 0u; i < 12u; i++) {
        let s = sin(latitude); let n = a / sqrt(1.0 - e2 * s * s);
        latitude = atan2(p.z + e2 * n * s, radial);
    }
    let longitude = atan2(p.y, p.x) - atan2(params.sun.y, params.sun.x);
    let u = longitudeToUnit(longitude, latitude);
    let size = vec3f(textureDimensions(solarTexture));
    let coord = vec3f((u * (size.x - 1.0) + 0.5) / size.x,
        ((latitude / PI + 0.5) * (size.y - 1.0) + 0.5) / size.y,
        (sqrt(clamp(h / params.axesTop.z, 0.0, 1.0)) * (size.z - 1.0) + 0.5) / size.z);
    let columns = textureSampleLevel(solarTexture, solarSampler, coord, 0.0);
    // Never interpolate optical depth through shadowed texels.
    if columns.w < 0.999999 { return directSolar(p); }
    cacheHits++;
    return exp(-(params.rayleigh.xyz * columns.x + vec3f(params.mie.y * columns.y)));
}
`;
/** The shared geometric equations use ellipsoid axes and geodetic altitude, not a sphere. */
export function solarGeometrySource(source) {
    return source.slice(0, source.indexOf('struct Node')) + `
@group(0) @binding(0) var<uniform> params: Parameters;
var<private> cacheHits: u32;
var<private> directCalls: u32;
` + source.slice(source.indexOf('const PI:'), source.indexOf('fn solar('));
}
export const solarLutBake = solarLutMapping + `
@group(0) @binding(1) var opticalTexture: texture_storage_3d<rgba16float, write>;
@compute @workgroup_size(8, 4, 1)
fn main(@builtin(global_invocation_id) invocation: vec3u) {
    let id = vec3u(invocation.xy, invocation.z + u32(params.settings.z));
    let size = textureDimensions(opticalTexture);
    if any(id >= size) { return; }
    let latitude = f32(id.y) / f32(size.y - 1u) * PI - 0.5 * PI;
    let longitude = longitudeFromUnit(f32(id.x) / f32(size.x - 1u), latitude);
    let z = f32(id.z) / f32(size.z - 1u);
    let h = params.axesTop.z * z * z;
    let a = params.axesTop.x; let b = params.axesTop.y; let e2 = 1.0 - b * b / (a * a);
    let normal = vec3f(cos(latitude) * cos(longitude), cos(latitude) * sin(longitude), sin(latitude));
    let n = a / sqrt(1.0 - e2 * normal.z * normal.z);
    let p = vec3f((n + h) * normal.x, (n + h) * normal.y, (n * (1.0 - e2) + h) * normal.z);
    var shadowed = blocked(p);
    // At the exact ground surface, avoid cancellation in the zero-distance root.
    if id.z == 0u { shadowed = dot(normal, params.sun.xyz) <= 0.0; }
    if shadowed { textureStore(opticalTexture, vec3i(id), vec4f(0.0)); return; }
    let hit = intersect(p, params.sun.xyz, 1.0 + params.axesTop.z / params.axesTop.y);
    let count = u32(params.settings.y); let ds = max(0.0, hit.y) / f32(count);
    var columns = vec2f(0.0);
    for (var i = 0u; i < count; i++) { columns += density(p + params.sun.xyz * ((f32(i) + 0.5) * ds)) * ds; }
    textureStore(opticalTexture, vec3i(id), vec4f(columns, 0.0, 1.0));
}
`;
