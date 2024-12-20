// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "lightVertexDeclarationVertexShader";
const shader = `#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING) 
#include<lightDefinition>
#include<lightCommonsDeclaration>
#if defined(FLAT_SHADING)
flat out vec4 vColor;#else
out vec4 vColor;#endif 
#elif defined(PHONG_SHADING) || defined(BLINN_PHONG_SHADING)
out vec3 vNormal;out vec3 vPosition;#endif
`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const lightVertexDeclarationVertexShader = { name, shader };