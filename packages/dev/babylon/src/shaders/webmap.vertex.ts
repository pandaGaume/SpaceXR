// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "webmapVertexShader";
const shader = `#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<lightVertexDeclaration>
#include<elevationVertexDeclaration>
uniform mat4 world;uniform mat4 viewProjection; in vec3 position; in vec2 uv; uniform vec3 uTerrainColor;void main(void) {#include<instancesVertex>
float depth=demIds[int(position.z)] ;vec3 v=vec3(uv.xy,depth);if( depth<0.0) {v.x=v.x==0.0 ? 1.0 : v.x;v.y=v.y==0.0 ? 1.0 : v.y; v.z=demIds[0];} float alt0=float(texture(uAltitudes,v)) ;float alt=(alt0-uMinAlt)*uMapscale*uExageration;vec4 p=world*vec4(position.xy,alt ,1.0);vec3 worldpos=(world*p).xyz;vec4 pixel=texture(uNormals,v);n=vec4(elevation_rgbaToNormal(pixel),1.0);vec3 worldnormal=normalize((world*n).xyz);#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
#if defined(SPECULAR)
vec3 lightColor=calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,worldnormal,worldpos,uViewPosition,uShininess);#else
vec3 lightColor=calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,worldnormal,worldPos);#endif
vColor=vec4(uTerrainColor*lightColor,1.);#endif
#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
vNormal=worldnormal;vPosition=worldpos;#endif
#include<clipVertex>
gl_Position=viewProjection*worldpos;}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const webmapVertexShader = { name, shader };