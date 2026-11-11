#if defined(RASTERDRAPE) && defined(UV1)
precision highp sampler2DArray;
uniform highp sampler2DArray drapePages;
uniform highp sampler2DArray drapeTables;
varying vec2 vDrapeUV;

vec4 rasterDrapeColor(vec2 tile) {
    // drapeInfo: x = depth, y = table layer.
    if (drapeInfo.y < 0.0) return vec4(0.0);
    float cells = exp2(drapeInfo.x);
    vec2 cell = clamp(floor(tile * cells), 0.0, cells - 1.0);
    vec4 entry = texelFetch(drapeTables, ivec3(ivec2(cell), int(drapeInfo.y)), 0);
    if (entry.x < 0.0) return vec4(0.0);
    // Point registration: the first and last texels lie on the page edges.
    float texels = float(textureSize(drapePages, 0).x);
    vec2 page = entry.yz + (tile * cells - cell) * entry.w;
    vec2 coordinates = (page * (texels - 1.0) + 0.5) / texels;
    // Pages have no mipmaps: an explicit level keeps the same colour and, unlike an implicit one, is allowed in the
    // non-uniform control flow of WGSL once Babylon converts this shader for WebGPU.
    return vec4(textureLod(drapePages, vec3(coordinates, entry.x), 0.0).rgb, 1.0);
}
#endif
