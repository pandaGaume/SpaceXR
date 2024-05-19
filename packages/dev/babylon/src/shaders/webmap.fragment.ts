// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "webmapFragmentShader";
const shader = `version 300 esprecision mediump float;#if defined(FLAT_SHADING) 
flat in vec3 vColor;#elif defined(GOUREAUD_SHADING)
in vec3 vColor;#endif
out vec4 fragColor;void main(void) {fragColor=vec4(vFaceColor,1.0);}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const webmapFragmentShader = { name, shader };