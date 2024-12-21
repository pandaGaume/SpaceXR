// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "lightFragmentDeclaration";
const shader = `#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
#include<lightDefinition>
#include<lightCommonsDeclaration>
in vec3 vNormal;in vec3 vPosition;#elif defined(FLAT_SHADING) 
flat in vec4 vColor;#elif defined(GOUREAUD_SHADING)
in vec4 vColor;#endif
`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const lightFragmentDeclaration = { name, shader };