// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "webmapVertexShader";
const shader = `#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<lightVertexDeclaration>
#include<elevationVertexDeclaration>
uniform mat4 viewProjection;in vec3 position; in vec2 uv; #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
uniform vec4 uTerrainColor;#endif
out vec3 vUvs;void main(void) {#include<instancesVertex>
float depth=demIds[int(position.z)] ;vec3 v=vec3(uv.xy,depth);if( depth<0.0) {v.x=v.x==0.0 ? 1.0 : v.x;v.y=v.y==0.0 ? 1.0 : v.y; depth=demIds[0];} float alt0=float(texture(uAltitudes,v)) ;float alt=(alt0 -uAltRange.x)*uMapScale;vec4 pos=vec4(position.xy,alt ,1.0);vec4 worldPosition=finalWorld*pos;vec4 pixel=texture(uNormals,v);vec3 worldNormal=elevation_rgbaToNormal(pixel); #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
#if defined(SPECULAR)
vec3 lightColor=calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,worldNormal,worldPosition.xyz,uViewPosition,uShininess);#else
vec3 lightColor=calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,worldNormal,worldPosition.xyz);#endif
vColor= vec4(uTerrainColor.rgb*lightColor,uTerrainColor.a);#endif
#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
vNormal=worldNormal;vPosition=worldPosition.xyz;#endif
#include<clipVertex>
gl_Position=viewProjection*worldPosition;vUvs=vec3(uv,depth);}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const webmapVertexShader = { name, shader };