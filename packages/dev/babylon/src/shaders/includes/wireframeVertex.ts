// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "wireframeVertex";
const shader = `vec3 tmp=barycentricWeight(gl_VertexID,altitudesSize);vBarys=tmp.xy ;vEdgeWeight=tmp.z;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const wireframeVertex = { name, shader };