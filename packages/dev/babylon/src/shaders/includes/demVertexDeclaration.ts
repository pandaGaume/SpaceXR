// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "demVertexDeclaration";
const shader = `struct DemInfos {vec3 max;vec3 min;float delta;float mean;sampler2D elevations;sampler2D normals;};uniform DemInfos demInfos;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const demVertexDeclaration = { name, shader };