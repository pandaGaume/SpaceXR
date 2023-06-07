// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapFragmentShader";
const shader = `precision highp float;#include<lightFragmentDeclaration>
#include<materialFragmentDeclaration>
#include<clipFragmentDeclaration>
varying vec4 vPosition;varying vec3 vNormal;uniform mat4 world;uniform DirLight light;uniform Material material;uniform vec3 viewPos;void main(void) {#include<clipFragment>
vec3 ambient =light.ambient*material.ambient;vec3 norm=normalize(vNormal);vec3 lightDir=normalize(light.direction);float diff=max(dot(norm,lightDir),0.0);vec3 diffuse =light.diffuse*(diff*material.diffuse);vec3 viewDir=normalize(viewPos-vPosition.xyz);vec3 reflectDir=reflect(lightDir,norm); float spec=pow(max(dot(viewDir,reflectDir),0.0),material.shininess);vec3 specular=light.specular*(spec*material.specular); vec3 result=ambient+diffuse+specular;gl_FragColor=vec4(result,1.0);}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapFragmentShader = { name, shader };