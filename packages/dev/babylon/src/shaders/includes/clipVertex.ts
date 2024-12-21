// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "clipVertex";
const shader = `#if defined(CLIP_PLANES)
vfClipDistance.x=clipDistance(worldPosition.xyz,uNorthClip);vfClipDistance.y=clipDistance(worldPosition.xyz,uSouthClip);vfClipDistance.z=clipDistance(worldPosition.xyz,uEastClip);vfClipDistance.w=clipDistance(worldPosition.xyz,uWestClip);#endif
`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const clipVertex = { name, shader };