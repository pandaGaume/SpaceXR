#include<lightFragmentDeclaration>
#include<clipFragmentDeclaration>

#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
uniform vec4 uTerrainColor;
#endif

void main(void) {
    
    #include<clipFragment>
    
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        gl_FragColor=vColor;
    #elif defined(PHONG_SHADING) || defined(BLINN_PHONG_SHADING)
        #if defined(SPECULAR)
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, normalize(vNormal), vPosition, uViewPosition, uShininess);
        #else
            vec3 lightColor= calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, normalize(vNormal), vPosition);
        #endif
        gl_FragColor= uTerrainColor * vec4(lightColor,1.);
    #endif
}