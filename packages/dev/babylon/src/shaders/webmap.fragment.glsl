#include<lightFragmentDeclaration>
#include<clipFragmentDeclaration>

#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
uniform vec4 uTerrainColor;
#endif

uniform highp sampler2DArray uTextures;
in vec3 vUvs;

void main(void) {
    
    #include<clipFragment>
    
    vec4 texColor = uTerrainColor; // texture(uTextures, vUvs);

    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        gl_FragColor=vColor;
    #elif defined(PHONG_SHADING) || defined(BLINN_PHONG_SHADING)
        #if defined(SPECULAR)
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, normalize(vNormal), vPosition, uViewPosition, uShininess);
        #else
            vec3 lightColor= calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, normalize(vNormal), vPosition);
        #endif
        gl_FragColor= texColor * vec4(lightColor,1.);
    #endif
}