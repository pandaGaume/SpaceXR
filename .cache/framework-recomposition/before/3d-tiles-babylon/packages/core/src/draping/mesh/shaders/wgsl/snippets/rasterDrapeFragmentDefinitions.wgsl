// WGSL twin of ../../snippets/rasterDrapeFragmentDefinitions.glsl: both compute the same values in the same order.
#if defined(RASTERDRAPE) && defined(UV1)
var drapePages: texture_2d_array<f32>;
var drapePagesSampler: sampler;
var drapeTables: texture_2d_array<f32>;
varying vDrapeUV: vec2f;

fn rasterDrapeColor(tile: vec2f) -> vec4f {
    // drapeInfo: x = depth, y = table layer.
    let drapeInfo = uniforms.drapeInfo;
    if (drapeInfo.y < 0.0) { return vec4f(0.0); }
    let cells = exp2(drapeInfo.x);
    let cell = clamp(floor(tile * cells), vec2f(0.0), vec2f(cells - 1.0));
    let entry = textureLoad(drapeTables, vec2i(cell), i32(drapeInfo.y), 0);
    if (entry.x < 0.0) { return vec4f(0.0); }
    // Point registration: the first and last texels lie on the page edges.
    let texels = f32(textureDimensions(drapePages, 0).x);
    let page = entry.yz + (tile * cells - cell) * entry.w;
    let coordinates = (page * (texels - 1.0) + 0.5) / texels;
    // Pages have no mipmaps: an explicit level keeps the same colour and is allowed in non-uniform control flow. The
    // layer is rounded as a GLSL array coordinate is.
    return vec4f(textureSampleLevel(drapePages, drapePagesSampler, coordinates, i32(floor(entry.x + 0.5)), 0.0).rgb, 1.0);
}
#endif
