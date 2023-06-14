// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapFragmentShader";
const shader = `precision highp float;#include<lightFragmentDeclaration>
#include<materialFragmentDeclaration>
#include<clipFragmentDeclaration>
in vec3 vNormal;in vec2 vUv;in float aDepth;uniform DirLight light;uniform Material material;uniform highp sampler2DArray normals;void main(void) {#include<clipFragment>
vec3 ambient =light.ambient*material.ambient;vec3 norm=normalize(vNormal);float diff=max(dot(norm,light.direction),0.0);vec3 diffuse =light.diffuse*(diff*material.diffuse);vec3 result=ambient+diffuse ;glFragColor=vec4(result,1.0) ;}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapFragmentShader = { name, shader };