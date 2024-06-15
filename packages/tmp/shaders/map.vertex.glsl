
#include<lightVertexDeclaration>

uniform mat4 world;
uniform mat4 worldViewProjection; 
uniform vec3 uTerrainColor;
in vec3 position; 
in vec3 normal;

void main(void) {
    vec4 p = vec4(position, 1.);
    vec3 wp = (world * p).xyz;
    vec4 n = vec4(normal, 1.);
    vec3 wn = normalize((world * n).xyz);
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        #if defined(SPECULAR)
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, wn, wp, uViewPosition, shininess);
        #else
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, wn, wp);
        #endif
        vColor=vec4(uTerrainColor*lightColor,1.);
    #endif
    #if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
        vNormal = wn;
        vPosition = wp;
    #endif
    gl_Position = worldViewProjection * p;
}