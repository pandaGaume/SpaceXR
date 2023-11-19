// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapFragmentShader";
const shader = `precision highp float;#include<clipFragmentDeclaration>
#if defined(WIREFRAME)
#include<wireframeFragmentDeclaration>
#endif
in vec3 vNormal;in vec3 vUvs;uniform highp sampler2DArray layer;uniform highp sampler2DArray altitudes;uniform vec4 backColor;void main(void) {#include<clipFragment>
#if defined(WIREFRAME)
#include<wireframeFragment>
#else
if(vUvs.z<0.0 ) {glFragColor=backColor;return ;}glFragColor=texture(layer,vUvs) ;#endif 
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapFragmentShader = { name, shader };