uniform mat4 world;
uniform mat4 worldViewProjection; 
uniform vec3 terrainColor;
in vec3 position; 
in vec3 normal;

#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING) 
    #include<lightDefinition>
    #include<lightDeclaration>
#endif

#if defined(FLAT_SHADING)
    flat varying vec4 vColor;
#endif

#if defined(GOUREAUD_SHADING)
    varying vec4 vColor;
#endif

#if defined(PHONG_SHADING)
    varying vec3 vNormal;
    varying vec3 vPosition;
#endif

void main(void) {
    vec4 p = vec4(position, 1.);
    vec3 wp = (world * p).xyz;
    vec4 n = vec4(normal, 1.);
    vec3 wn = normalize((world * n).xyz);
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, wn, wp);
        vColor=vec4(terrainColor*lightColor,1.);
    #endif
    #if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
        vNormal = wn;
        vPosition = wp;
    #endif
    gl_Position = worldViewProjection * p;
}