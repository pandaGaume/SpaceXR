// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "textureDepthVertexDeclaration";
const shader = `in vec4 textureDepths;out vec2 vUvs;flat out float depth;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const textureDepthVertexDeclaration = { name, shader };