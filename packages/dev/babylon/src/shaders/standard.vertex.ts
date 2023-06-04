// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "standardVertexShader";
const shader = `precision highp float;attribute vec3 position;attribute vec3 normal;uniform mat4 worldViewProjection;varying vec4 vPosition;varying vec3 vNormal;void main(void) {vPosition=vec4(position,1.0);vec4 outPosition=worldViewProjection*vPosition ;gl_Position=outPosition;vNormal=normal; }`;
ShaderStore.ShadersStore["standardVertexShader"] = shader;
/** @internal */ export const standardVertexShader = { name, shader };