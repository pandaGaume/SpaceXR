// WGSL twin of ../../snippets/rasterDrapeFragmentUpdateDiffuse.glsl.
#if defined(RASTERDRAPE) && defined(UV1)
let drapeColor = rasterDrapeColor(vec2f(fragmentInputs.vDrapeUV.x, 1.0 - fragmentInputs.vDrapeUV.y));
if (drapeColor.a > 0.0) {
    baseColor = vec4f(drapeColor.rgb, baseColor.a);
    diffuseColor = vec3f(1.0);
}
#endif
