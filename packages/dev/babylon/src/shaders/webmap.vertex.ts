// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "webmapVertexShader";
const shader = `precision highp float;#include<instancesDeclaration>
uniform mat4 viewProjection; in vec3 position; in vec2 uv; #include<clipVertexDeclaration>
#include<elevationDeclaration>
uniform highp sampler2DArray altitudes;uniform highp sampler2DArray normals;uniform vec2 overallAltitudeRange;uniform sampler2D layerIds;in vec4 demIds; in vec3 layerAddress; out vec4 vPosition;out vec3 vNormal;out vec3 vUvs;void main(void) {#include<instancesVertex>
float depth=demIds[int(position.z)] ;vec3 v=vec3(uv.xy,depth);if( depth<0.0) {v.x=v.x==0.0 ? 1.0 : v.x;v.y=v.y==0.0 ? 1.0 : v.y; v.z=demIds[0];} float alt0=float(texture(altitudes,v)) ;float alt=alt0-overallAltitudeRange.x ;vPosition=vec4(position.xy,alt ,1.0) ;vec4 worldPos=finalWorld*vPosition;gl_Position=viewProjection*worldPos;vec4 pixel=texture(normals,v);vNormal=elevation_rgbaToNormal(pixel)depth=layerIds[0] ;vUvs=vec3(position.xy+0.5,depth);}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const webmapVertexShader = { name, shader };