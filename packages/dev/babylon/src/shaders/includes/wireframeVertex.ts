// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "wireframeVertex";
const shader = `ivec3 altitudesSize =textureSize(altitudes,0);vec3 tmp=barycentricWeight(gl_VertexID,ivec2(altitudesSize.x+1,altitudesSize.y+1));vBarys=tmp.xy ;vEdgeWeight=tmp.z;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const wireframeVertex = { name, shader };