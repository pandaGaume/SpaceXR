// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "light_decl";
const shader = `struct DirLight {vec3 direction;vec3 ambient;vec3 diffuse;vec3 specular;}; `;
ShaderStore.IncludesShadersStore["light_decl"] = shader;
/** @internal */ export const light_decl = { name, shader };