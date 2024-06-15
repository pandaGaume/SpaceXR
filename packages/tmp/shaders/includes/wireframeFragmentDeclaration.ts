// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "wireframeFragmentDeclaration";
const shader = `#define Z_WEIGHT(b) 1.0
float edgeFactor(vec2 w,float thickness){vec3 b=vec3(w,Z_WEIGHT(w));vec3 d=fwidth(b);vec3 a3=smoothstep(vec3(0.0),d*thickness,b);return min(min(a3.x,a3.y),a3.z);}uniform float edgeThickness;uniform vec4 edgeColor;varying float vEdgeWeight;varying vec2 vBarys;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const wireframeFragmentDeclaration = { name, shader };