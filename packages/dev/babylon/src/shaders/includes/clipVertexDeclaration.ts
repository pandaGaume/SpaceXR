// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "clipVertexDeclaration";
const shader = `#if defined(HOLOGRAPHIC_BOUNDS_BOX)
struct Plane{vec3 point;vec3 normal;};float clipDistance(vec3 worldPos,Plane plane ){vec3 p=worldPos-plane.point;return dot(p,plane.normal);}uniform Plane uNorthClip;uniform Plane uSouthClip;uniform Plane uEastClip;uniform Plane uWestClip;out vec4 vfClipDistance;#endif
#if defined(HOLOGRAPHIC_BOUNDS_SPHERE)
uniform float uRadiusClip;out vec4 vfClipDistance;#endif
#if defined(HOLOGRAPHIC_BOUNDS_CYLINDER)
uniform float uRadiusClip;uniform vec3 uHeightClip;out vec4 vfClipDistance;#endif
`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const clipVertexDeclaration = { name, shader };