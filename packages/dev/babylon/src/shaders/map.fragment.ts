// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "mapPixelShader";
const shader = `precision highp float;#include<clipFragmentDeclaration>
in vec2 vUvs;flat in int vId;flat in vec3 vColor;void main(void) {#include<clipFragment>
gl_FragColor=vec4(vColor,1.0); }`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const mapPixelShader = { name, shader };