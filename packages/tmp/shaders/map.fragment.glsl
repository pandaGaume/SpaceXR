#include<lightFragmentDeclaration>

uniform vec3 uTerrainColor;

void main(void) {
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        gl_FragColor=vColor;
    #elif defined(PHONG_SHADING) || defined(BLINN_PHONG_SHADING)
        #if defined(SPECULAR)
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, normalize(vNormal), vPosition, uViewPosition, shininess);
        #else
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, normalize(vNormal), vPosition);
        #endif
        gl_FragColor=vec4(lightColor,1.);
        #endif
}