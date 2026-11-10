#if defined(RASTERDRAPE) && defined(UV1)
vec4 drapeColor = rasterDrapeColor(vec2(vDrapeUV.x, 1.0 - vDrapeUV.y));
if (drapeColor.a > 0.0) {
    baseColor.rgb = drapeColor.rgb;
    diffuseColor = vec3(1.0);
}
#endif
