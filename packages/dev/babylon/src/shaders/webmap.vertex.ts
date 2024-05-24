// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "webmapVertexShader";
const shader = `#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<lightVertexDeclaration>
#include<elevationVertexDeclaration>
uniform mat4 viewProjection; in vec3 position; in vec2 uv; #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
uniform vec4 uTerrainColor;#endif
void main(void) {#include<instancesVertex>
float alt=0.0; vec4 pos=vec4(position.xy,alt ,1.0);vec4 worldPosition=finalWorld*pos;vec4 n=vec4(0.0,0.0,1.0,1.0);vec4 worldNormal=normalize(finalWorld*n);#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
#if defined(SPECULAR)
vec3 lightColor=calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,worldNormal.xyz,worldPosition.xyz,uViewPosition,uShininess);#else
vec3 lightColor=calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,worldNormal.xyz,worldPosition.xyz);#endif
vColor=uTerrainColor* vec4(lightColor,1.);#endif
#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
vNormal=worldNormal.xyz;vPosition=worldPosition.xyz;#endif
#include<clipVertex>
gl_Position=viewProjection*worldPosition;}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const webmapVertexShader = { name, shader };