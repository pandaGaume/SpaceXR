// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapFragmentShader";
const shader = `precision highp float;#include<lightFragmentDeclaration>
#include<materialFragmentDeclaration>
#include<clipFragmentDeclaration>
in vec3 vNormal;in vec3 vUvs;uniform DirLight light;uniform Material material;uniform highp sampler2DArray layer;void main(void) {#include<clipFragment>
glFragColor=texture(layer,vUvs) ;}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapFragmentShader = { name, shader };