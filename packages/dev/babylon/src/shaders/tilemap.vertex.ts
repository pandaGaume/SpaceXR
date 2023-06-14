// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapVertexShader";
const shader = `precision highp float;in vec3 position;in vec4 demInfos;in vec2 textureIds;#include<instancesDeclaration>
#include<clipVertexDeclaration>
uniform mat4 viewProjection;uniform highp sampler2DArray altitudes;uniform highp sampler2DArray normals;uniform highp float minAlt;out vec4 vPosition;out vec3 vNormal;out vec2 vUv;out float aDepth;void main(void) {#include<instancesVertex>
float x=max(position.x+.5,0.01) ;float y=position.y+.5 ;vec2 uv=vec2(x,y);float alt=float(texture(altitudes,vec3(uv,textureIds.x) )) ;float z=(alt-minAlt)*0.01;vPosition=vec4(position.xy,z ,1.0) ;vec4 worldPos=finalWorld*vPosition;gl_Position=viewProjection*worldPos;vec4 pixel=texture(normals,vec3(uv,textureIds.y) );x=(2.0*pixel.r)-1.0;y=(2.0*pixel.g)-1.0;z=(pixel.b*255.0-128.0)/127.0;vNormal=vec3(x,z,y);vUv=uv;aDepth=textureIds.y;#include<clipVertex>
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapVertexShader = { name, shader };