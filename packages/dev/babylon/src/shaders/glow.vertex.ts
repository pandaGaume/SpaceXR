// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "glowVertexShader";
const shader = `precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;void main(void) {vUV=uv;gl_Position=worldViewProjection*vec4(position,1.0);}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const glowVertexShader = { name, shader };