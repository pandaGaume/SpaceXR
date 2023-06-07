// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapVertexShader";
const shader = `precision highp float;attribute vec3 position;attribute vec3 normal;#include<instancesDeclaration>
#include<clipVertexDeclaration>
uniform mat4 viewProjection;varying vec4 vPosition;varying vec3 vNormal;void main(void) {#include<instancesVertex>
vPosition=vec4(position,1.0);vec4 worldPos=finalWorld*vPosition ;vec4 outPosition=viewProjection*worldPos ;gl_Position=outPosition;vNormal=normal; #include<clipVertex>
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapVertexShader = { name, shader };