// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "clipVertex";
const shader = `vfClipDistance.x=clipDistance(worldPos,northClip);vfClipDistance.y=clipDistance(worldPos,southClip);vfClipDistance.z=clipDistance(worldPos,eastClip);vfClipDistance.w=clipDistance(worldPos,westClip);`;
ShaderStore.IncludesShadersStore["clipVertex"] = shader;
/** @internal */ export const clipVertex = { name, shader };