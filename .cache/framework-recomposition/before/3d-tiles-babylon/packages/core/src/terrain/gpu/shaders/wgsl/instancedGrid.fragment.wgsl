// WGSL twin of ../instancedGrid.fragment.glsl, used by the WebGPU engine: imagery, then the normal and the lighting of
// the surface. Both compute the same values in the same order: change them together.

#ifdef RUNTIME_SELECTION
varying vDrape: vec4f;
#ifdef IMAGERY
var imageryTables: texture_2d_array<f32>;
#endif
#else
varying vImagery: vec3f;
#endif
#ifndef AMBIENT_ONLY
#ifdef RUNTIME_SELECTION
varying vTile: vec2f;
varying vPage: vec4f;
varying vUp: vec3f;
#ifdef PROVIDER_NORMALS
varying vNormalPage: vec4f;
var normalTextures: texture_2d_array<f32>;
var normalTexturesSampler: sampler;
uniform normalSize: f32;
#endif
varying vEast: vec3f;
varying vSouth: vec3f;
varying vEdgeN: vec4f;
varying vEdgeE: vec4f;
varying vEdgeS: vec4f;
varying vEdgeW: vec4f;
var elevations: texture_2d_array<f32>;
uniform verticalScale: f32;
uniform cells: f32;
#else
varying vNormal: vec3f;
#endif
#endif

uniform baseColor: vec3f;
#ifndef AMBIENT_ONLY
// Directional light: direction towards the light, colour times intensity.
uniform sunDirection: vec3f;
uniform sunColor: vec3f;
// Hemispheric light: direction of the sky, sky and ground colours times intensity.
uniform skyDirection: vec3f;
uniform skyColor: vec3f;
uniform groundColor: vec3f;
#endif
#ifdef IMAGERY
var imagery: texture_2d_array<f32>;
var imagerySampler: sampler;
uniform imagerySize: f32;
#endif

#ifndef AMBIENT_ONLY
#ifdef RUNTIME_SELECTION
// Central differences include the one-sample gutter copied from resident neighbour DEMs.
fn sampleGradient(sample: vec2i, layer: i32) -> vec2f {
    let p = sample + vec2i(1);
    let west = textureLoad(elevations, p - vec2i(1, 0), layer, 0).r;
    let east = textureLoad(elevations, p + vec2i(1, 0), layer, 0).r;
    let north = textureLoad(elevations, p - vec2i(0, 1), layer, 0).r;
    let south = textureLoad(elevations, p + vec2i(0, 1), layer, 0).r;
    return 0.5 * vec2f(east - west, south - north);
}

// Gradient of the height per unit of tile coordinate, at a point of a DEM page: the gradients of its four nearest
// samples interpolated, so that lighting stays smooth across the cells of the DEM.
fn heightGradient(page: vec4f, tile: vec2f) -> vec2f {
    if (page.w < 0.0) { return vec2f(0.0); }
    let last = i32(textureDimensions(elevations, 0).x) - 3;
    let turns = i32(fract(page.w + 0.125) * 4.0);
    var uv = tile;
    if (turns == 1) { uv = vec2f(1.0 - tile.y, tile.x); }
    else if (turns == 2) { uv = vec2f(1.0 - tile.x, 1.0 - tile.y); }
    else if (turns == 3) { uv = vec2f(tile.y, 1.0 - tile.x); }
    let texel = (page.xy + uv * page.z) * f32(last);
    let base = clamp(vec2i(floor(texel)), vec2i(0), vec2i(last - 1));
    let f = clamp(texel - vec2f(base), vec2f(0.0), vec2f(1.0));
    let layer = i32(floor(page.w + 0.125));
    let top = mix(sampleGradient(base, layer), sampleGradient(base + vec2i(1, 0), layer), f.x);
    let bottom = mix(sampleGradient(base + vec2i(0, 1), layer), sampleGradient(base + vec2i(1, 1), layer), f.x);
    var gradient = mix(top, bottom, f.y) * page.z * f32(last) * uniforms.verticalScale;
    if (turns == 1) { gradient = vec2f(gradient.y, -gradient.x); }
    else if (turns == 2) { gradient = -gradient; }
    else if (turns == 3) { gradient = vec2f(-gradient.y, gradient.x); }
    return gradient;
}

#ifdef PROVIDER_NORMALS
// Provider pixels encode tangent-space east, north and up as 128 * (component + 1). Alpha is not opacity.
fn providerNormal(result: ptr<function, vec3f>) -> bool {
    let normalPage = fragmentInputs.vNormalPage;
    if (normalPage.w < 0.0) { return false; }
    let page = normalPage.xy + fragmentInputs.vTile * normalPage.z;
    let uv = (clamp(page, vec2f(0.0), vec2f(1.0)) * (uniforms.normalSize - 1.0) + 0.5) / uniforms.normalSize;
    var tangent = textureSampleLevel(normalTextures, normalTexturesSampler, uv, i32(floor(normalPage.w + 0.5)), 0.0).rgb * (255.0 / 128.0) - 1.0;
    if (dot(tangent, tangent) < 0.00000001) { return false; }
    tangent = normalize(tangent);
    tangent = vec3f(tangent.xy * uniforms.verticalScale, tangent.z);
    *result = normalize(normalize(fragmentInputs.vEast) * tangent.x - normalize(fragmentInputs.vSouth) * tangent.y + normalize(fragmentInputs.vUp) * tangent.z);
    return true;
}
#endif

// Geometry joins the coarsest DEM on an edge. Its normal must follow that same surface,
// fading into the interior over one grid cell instead of switching DEM gradients abruptly.
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
#endif
#endif

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    var albedo = uniforms.baseColor;
#ifdef IMAGERY
#ifdef RUNTIME_SELECTION
    let drape = fragmentInputs.vDrape;
    if (drape.w >= 0.0) {
        let side = exp2(drape.z);
        let tile = clamp(drape.xy, vec2f(0.0), vec2f(1.0));
        let cell = clamp(floor(tile * side), vec2f(0.0), vec2f(side - 1.0));
        let entry = textureLoad(imageryTables, vec2i(cell), i32(drape.w + 0.5), 0);
        if (entry.x >= 0.0) {
            let page = entry.yz + (tile * side - cell) * entry.w;
            let uv = (clamp(page, vec2f(0.0), vec2f(1.0)) * (uniforms.imagerySize - 1.0) + 0.5) / uniforms.imagerySize;
            albedo = textureSampleLevel(imagery, imagerySampler, uv, i32(floor(entry.x + 0.5)), 0.0).rgb;
        }
    }
#else
    let imageryArea = fragmentInputs.vImagery;
    if (imageryArea.z >= 0.0) {
        // Point registration: page coordinate t lies at the centre of texel t * (size - 1).
        let uv = (clamp(imageryArea.xy, vec2f(0.0), vec2f(1.0)) * (uniforms.imagerySize - 1.0) + 0.5) / uniforms.imagerySize;
        // No mipmaps: an explicit level is the same colour, and allowed in non-uniform control flow.
        albedo = textureSampleLevel(imagery, imagerySampler, uv, i32(floor(imageryArea.z + 0.5)), 0.0).rgb;
    }
#endif
#endif
#ifdef AMBIENT_ONLY
    // Uniform white ambient illumination preserves the imagery without computing a terrain normal.
    fragmentOutputs.color = vec4f(albedo, 1.0);
#else
#ifdef RUNTIME_SELECTION
    // The normal of the displaced surface reads the DEM at each pixel, not the vertices of the grid: see the GLSL shader.
    var normal: vec3f;
#ifdef PROVIDER_NORMALS
    if (!providerNormal(&normal)) {
#endif
    let up = normalize(fragmentInputs.vUp);
    let gradient = joinedGradient(fragmentInputs.vTile);
    normal = normalize(cross(fragmentInputs.vEast + up * gradient.x, -(fragmentInputs.vSouth + up * gradient.y)));
#ifdef PROVIDER_NORMALS
    }
#endif
#else
    let normal = normalize(fragmentInputs.vNormal);
#endif
    // The lighting of the Babylon standard material, without specular.
    let light = uniforms.sunColor * max(dot(normal, uniforms.sunDirection), 0.0)
        + mix(uniforms.groundColor, uniforms.skyColor, 0.5 * dot(normal, uniforms.skyDirection) + 0.5);
    fragmentOutputs.color = vec4f(clamp(albedo * light, vec3f(0.0), vec3f(1.0)), 1.0);
#endif
}
