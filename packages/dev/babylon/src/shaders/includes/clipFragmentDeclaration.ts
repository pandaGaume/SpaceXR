// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "clipFragmentDeclaration";
const shader = `#if defined(HOLOGRAPHIC_BOUNDS_BOX) || defined(HOLOGRAPHIC_BOUNDS_CYLINDER) || defined(HOLOGRAPHIC_BOUNDS_SPHERE)
varying vec4 vfClipDistance;#endif
`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const clipFragmentDeclaration = { name, shader };