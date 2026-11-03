// Physical calculations use kilometers. Optical coefficients are converted from inverse meters.
struct Parameters {
    origin: vec4f,
    sun: vec4f,
    axesTop: vec4f,
    rayleigh: vec4f,
    mie: vec4f,
    settings: vec4f,
}
struct Node {
    centerHalf: vec4f,
    childA: vec4u,
    childB: vec4u,
    flags: vec4u,
    solar: array<vec4f, 8>,
}
struct Result { radiance: vec4f, transmittance: vec4f }
@group(0) @binding(0) var<uniform> params: Parameters;
@group(0) @binding(1) var<storage, read> rays: array<vec4f>;
@group(0) @binding(2) var<storage, read> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> results: array<Result>;
var<private> cacheHits: u32;
var<private> directCalls: u32;
const PI: f32 = 3.141592653589793;
fn intersect(o: vec3f, d: vec3f, scale: f32) -> vec2f {
    let axes = vec3f(params.axesTop.x, params.axesTop.x, params.axesTop.y) * scale;
    let q = o / axes; let v = d / axes;
    let a = dot(v, v); let b = dot(q, v); let c = dot(q, q) - 1.0;
    let disc = b * b - a * c;
    if disc < 0.0 { return vec2f(1.0, -1.0); }
    let root = sqrt(disc);
    let stable = -b - select(-root, root, b >= 0.0);
    if abs(stable) < 1e-20 { return vec2f(-b / a); }
    let t0 = stable / a; let t1 = c / stable;
    return vec2f(min(t0, t1), max(t0, t1));
}
fn altitude(p: vec3f) -> f32 {
    let a = params.axesTop.x; let b = params.axesTop.y;
    let q = p / vec3f(a, a, b);
    if dot(q, q) < 1.0 { return -1.0; }
    let radial = length(p.xy);
    if radial < 1e-5 { return abs(p.z) - b; }
    let e2 = 1.0 - b * b / (a * a);
    var lat = atan2(p.z, radial * (1.0 - e2));
    for (var i = 0u; i < 12u; i++) {
        let s = sin(lat); let n = a / sqrt(1.0 - e2 * s * s);
        lat = atan2(p.z + e2 * n * s, radial);
    }
    let s = sin(lat);
    return max(0.0, radial * cos(lat) + p.z * s - a * sqrt(1.0 - e2 * s * s));
}
fn density(p: vec3f) -> vec2f {
    let h = altitude(p);
    if h < 0.0 || h > params.axesTop.z { return vec2f(0.0); }
    return exp(-h / params.mie.zw);
}
fn extinction(rho: vec2f) -> vec3f { return params.rayleigh.xyz * rho.x + vec3f(params.mie.y * rho.y); }
fn blocked(p: vec3f) -> bool {
    let hit = intersect(p, params.sun.xyz, 1.0);
    return hit.y > 1e-5 && hit.x >= -1e-5;
}
fn directSolar(p: vec3f) -> vec3f {
    directCalls++;
    if blocked(p) { return vec3f(0.0); }
    let hit = intersect(p, params.sun.xyz, 1.0 + params.axesTop.z / params.axesTop.y);
    if hit.y <= 0.0 { return vec3f(1.0); }
    let count = u32(params.settings.y); let ds = hit.y / f32(count);
    var tau = vec3f(0.0);
    for (var i = 0u; i < count; i++) { tau += extinction(density(p + params.sun.xyz * ((f32(i) + 0.5) * ds))) * ds; }
    return exp(-tau);
}
fn solar(p: vec3f) -> vec3f {
    if params.settings.w < 0.5 { return directSolar(p); }
    if blocked(p) { return vec3f(0.0); }
    var index = 0u;
    for (var level = 0u; level < 25u; level++) {
        let cell = nodes[index];
        let side = p >= cell.centerHalf.xyz;
        let octant = select(0u, 1u, side.x) + select(0u, 2u, side.y) + select(0u, 4u, side.z);
        var child: u32;
        if octant < 4u { child = cell.childA[octant]; } else { child = cell.childB[octant - 4u]; }
        if child == 0u {
            if cell.flags.x == 0u { return directSolar(p); }
            let uvw = clamp((p - cell.centerHalf.xyz + cell.centerHalf.w) / (2.0 * cell.centerHalf.w), vec3f(0.0), vec3f(1.0));
            var value = vec3f(0.0);
            for (var j = 0u; j < 8u; j++) {
                let weights = vec3f(select(1.0 - uvw.x, uvw.x, (j & 1u) != 0u), select(1.0 - uvw.y, uvw.y, (j & 2u) != 0u), select(1.0 - uvw.z, uvw.z, (j & 4u) != 0u));
                value += cell.solar[j].xyz * weights.x * weights.y * weights.z;
            }
            cacheHits++;
            return blendSeams(p, uvw, value);
        }
        index = child;
    }
    return directSolar(p);
}
fn blendSeams(p: vec3f, uvw: vec3f, cached: vec3f) -> vec3f {
    let distance = min(uvw, vec3f(1.0) - uvw);
    let margin = min(distance.x, min(distance.y, distance.z));
    let width = params.origin.w;
    if width > 0.0 && margin < width {
        let t = clamp(margin / width, 0.0, 1.0);
        return mix(directSolar(p), cached, t * t * (3.0 - 2.0 * t));
    }
    return cached;
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if id.x >= u32(params.settings.z) { return; }
    let o = params.origin.xyz; let d = normalize(rays[id.x].xyz);
    let hit = intersect(o, d, 1.0 + params.axesTop.z / params.axesTop.y);
    let start = max(0.0, hit.x); var end = hit.y;
    let ground = intersect(o, d, 1.0);
    if ground.y >= start && ground.x >= start { end = min(end, ground.x); }
    var light = vec3f(0.0); var transmission = vec3f(1.0);
    let mu = dot(d, params.sun.xyz); let g = 0.8;
    let phaseR = 3.0 * (1.0 + mu * mu) / (16.0 * PI);
    let phaseM = 3.0 * (1.0 - g * g) * (1.0 + mu * mu) / (8.0 * PI * (2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
    var t = start;
    loop {
        if t >= end { break; }
        let ds = min(params.settings.x, end - t);
        let p = o + d * (t + ds * 0.5); let rho = density(p);
        if any(rho > vec2f(0.0)) {
            let ext = extinction(rho); let stepT = exp(-ext * ds);
            let source = solar(p) * (params.rayleigh.xyz * rho.x * phaseR + vec3f(params.mie.x * rho.y * phaseM));
            var weight = vec3f(ds);
            for (var c = 0u; c < 3u; c++) {
                if ext[c] > 1e-7 { weight[c] = (1.0 - stepT[c]) / ext[c]; }
            }
            light += transmission * source * weight; transmission *= stepT;
        }
        t += ds;
    }
    results[id.x] = Result(vec4f(light, f32(cacheHits)), vec4f(transmission, f32(directCalls)));
}
