
#if defined(FLAT_SHADING) 
    flat in vec4 vColor;
#elif defined(GOUREAUD_SHADING)
    in vec4 vColor;
#endif

#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
    #include<lightDefinition>
    #include<lightDeclaration>
    in vec3 vNormal;
    in vec3 vPosition;
#endif

uniform vec3 terrainColor;

void main(void) {
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        gl_FragColor=vColor;
    #elif defined(PHONG_SHADING)
        vec3 lightColor= terrainColor * calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, vNormal, vPosition);
        gl_FragColor=vec4(lightColor,1.);
    #endif
}