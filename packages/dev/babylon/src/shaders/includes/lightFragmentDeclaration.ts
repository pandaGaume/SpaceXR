// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "lightFragmentDeclaration";
const shader = `struct DirLight {vec3 direction;vec3 ambient;vec3 diffuse;vec3 specular;}; `;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const lightFragmentDeclaration = { name, shader };