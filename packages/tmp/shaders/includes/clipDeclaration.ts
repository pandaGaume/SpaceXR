// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "clipDeclaration";
const shader = `struct ClipPlanes {vec3 north;vec3 south;vec3 east;vec3 west;}uniform ClipPlanes clipPlanes;varying vec4 vfClipDistance;`;
ShaderStore.IncludesShadersStore["clipDeclaration"] = shader;
/** @internal */ export const clipDeclaration = { name, shader };