// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapFragmentShader";
const shader = `precision highp float;#include<lightFragmentDeclaration>
#include<materialFragmentDeclaration>
#include<clipFragmentDeclaration>
in vec3 vNormal;in vec3 vUvs;in vec3 vUvsElevation;uniform DirLight light;uniform Material material;uniform highp sampler2DArray layer;uniform highp sampler2DArray altitudes;uniform vec4 backColor;void main(void) {#include<clipFragment>
if(vUvs.z<0.0 ) {/*float alt0=float(texture(altitudes,vUvsElevation)) ;float minorInterval=100.0;float tolerance=2.0;float minorLines=mod(alt0,minorInterval);if (minorLines<tolerance) {vec3 contourColor=vec3(0.11,0.75,0.81); glFragColor=vec4(contourColor,1.0);} else {vec3 black=vec3(0.0,0.0,0.0); glFragColor=vec4(black,1.0);}*/glFragColor=backColor;return ;}glFragColor=texture(layer,vUvs) ;}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapFragmentShader = { name, shader };