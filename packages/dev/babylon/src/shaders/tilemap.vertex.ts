// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapVertexShader";
const shader = `precision highp float;in vec3 position; in vec2 uv; in vec4 demIds; in vec4 layerIds; #if defined(WIREFRAME)
#include<wireframeVertexDeclaration>
#endif
#include<instancesDeclaration>
#include<clipVertexDeclaration>
uniform mat4 viewProjection; uniform highp sampler2DArray altitudes;uniform highp sampler2DArray normals;uniform highp float minAlt;uniform highp float mapscale;uniform highp float exageration;out vec4 vPosition;out vec3 vNormal;out vec3 vUvs;void main(void) {#include<instancesVertex>
float depth=demIds[int(position.z)] ;vec3 v=vec3(uv.xy,depth);if( depth<0.0) {v.x=v.x==0.0 ? 1.0 : v.x;v.y=v.y==0.0 ? 1.0 : v.y; v.z=demIds[0];} float alt0=float(texture(altitudes,v)) ;float alt=(alt0-minAlt)*mapscale*exageration;vPosition=vec4(position.xy,alt ,1.0) ;vec4 worldPos=finalWorld*vPosition;gl_Position=viewProjection*worldPos;vec4 pixel=texture(normals,v);float x=(2.0*pixel.r)-1.0;float y=(2.0*pixel.g)-1.0;float z=(pixel.b*255.0-128.0)/127.0;vNormal=vec3(x,z,y);depth=layerIds[0] ;vUvs=vec3(position.xy+0.5,depth);#include<clipVertex>
#if defined(WIREFRAME)
#include<wireframeVertex>
#endif
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapVertexShader = { name, shader };