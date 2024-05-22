// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "basicVertexShader";
const shader = `precision highp float;#include<instancesDeclaration>
attribute vec3 position;uniform mat4 viewProjection;void main(void) {#include<instancesVertex>
vec4 worldPosition=finalWorld*vec4(position,1.0);gl_Position=viewProjection*worldPosition;}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const basicVertexShader = { name, shader };