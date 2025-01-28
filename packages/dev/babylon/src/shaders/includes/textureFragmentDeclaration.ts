// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "textureFragmentDeclaration";
const shader = `uniform highp sampler2DArray uTextures;in vec2 vUvs;flat in float depth;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const textureFragmentDeclaration = { name, shader };