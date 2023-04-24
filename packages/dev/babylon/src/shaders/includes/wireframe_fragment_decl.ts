// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";

const wireframe_fragment_decl = `#if defined(WIREFRAME_SQUARE)
#define Z_WEIGHT(b) 1.0
uniform vec2 edgeVisibilityRange ;#if defined(WIREFRAME_EDGE_WEIGHT)
varying float vEdgeWeight;#endif 
#else 
#define Z_WEIGHT(b) 1.0- b.x-b.y
#endif 
float edgeFactor(vec2 w,float thickness){vec3 b=vec3(w,Z_WEIGHT(w));vec3 d=fwidth(b);vec3 a3=smoothstep(vec3(0.0),d*thickness,b);return min(min(a3.x,a3.y),a3.z);}uniform float edgeThickness;varying vec2 vBarys;`;
ShaderStore.IncludesShadersStore["wireframe_fragment_decl"] = wireframe_fragment_decl;
