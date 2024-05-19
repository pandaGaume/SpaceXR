// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "webmapVertexShader";
const shader = `version 300 esprecision mediump float;#include<instancesDeclaration>
uniform mat4 viewProjection; in vec3 position; in vec2 uv; #include<clipVertexDeclaration>
#include<elevationDeclaration>
#if !defined(FLAT_SHADING) && !defined(GOUREAUD_SHADING)
#define FLAT_SHADING 
#endif
#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING) 
#include<lights>
#include<lightDeclaration>
#endif
#ifdef FLAT_SHADING
flat varying vec3 vColor;#endif
#ifdef GOUREAUD_SHADING
varying vec3 vColor;#endif
uniform mat4 clipSpace;uniform vec4 clipPlane;uniform highp sampler2DArray altitudes;uniform highp sampler2DArray normals;uniform vec2 overallAltitudeRange;in vec4 demIds; in vec4 terrainColor; out vec4 vPosition;out vec3 vNormal;void main(void) {#include<instancesVertex>
float depth=demIds[int(position.z)] ;vec3 v=vec3(uv.xy,depth);if( depth<0.0) {v.x=v.x==0.0 ? 1.0 : v.x;v.y=v.y==0.0 ? 1.0 : v.y; v.z=demIds[0];} float alt0=float(texture(altitudes,v)) ;float alt=alt0-overallAltitudeRange.x ;vPosition=vec4(position.xy,alt ,1.0) ;vec4 worldPos=finalWorld*vPosition;gl_Position=viewProjection*worldPos;vNormal=elevation_rgbaToNormal(pixel)#if defined(FLAT_SHADING) 
if (gl_VertexID % 3==0) { vec3 lightColor=calculateLight(uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,vNormal,worldPos.xyz);vColor=terrainColor.rgba*vec4(lightColor.rgb,1.0);}#elif defined(GOUREAUD_SHADING)
vec3 lightColor=calculateLight(uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,vNormal,worldPos.xyz);vColor=terrainColor.rgba*vec4(lightColor.rgb,1.0);#endif
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const webmapVertexShader = { name, shader };