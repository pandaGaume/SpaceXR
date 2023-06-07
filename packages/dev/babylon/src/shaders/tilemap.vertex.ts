// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapVertexShader";
const shader = `precision highp float;attribute vec3 position;#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<demVertexDeclaration>
uniform mat4 viewProjection;uniform sampler2D altitudes;uniform sampler2D normals;varying vec4 vPosition;varying vec3 vNormal;void main(void) {#include<instancesVertex>
float x=(position.x+.5);float y=(position.y+.5);vec2 uv=vec2(x,y);float alt=float(texture2D(altitudes,uv )) ;float z=((alt-demInfos.min.z)/ demInfos.delta)*10.0 ;vPosition=vec4(position.xy,z ,1.0) ;vec4 worldPos=finalWorld*vPosition;gl_Position=viewProjection*worldPos;vec4 pixel=texture2D(normals,uv );x=(2.0*pixel.r)-1.0;y=(2.0*pixel.g)-1.0;z=(pixel.b*255.0-128.0)/127.0;vNormal=vec3(x,y,z);#include<clipVertex>
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapVertexShader = { name, shader };