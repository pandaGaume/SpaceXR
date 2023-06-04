// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "wireframe_vertex_decl";
const shader = `const vec2 BARYCENTRIC_VALUES[3]=vec2[](vec2(1.0,0.0),vec2(0.0,1.0),vec2(0.0,0.0) );const int INDEX_PATTERN [4]=int[](1,2,2,0);vec3 barycentricWeight(int vertexId,ivec2 dim){float vertexIndex=float(vertexId);float w=float(dim.x);float line=floor(vertexIndex/w) ; float col=mod(vertexIndex,w);float lineoffset=mod(line,2.0) ; float offset=lineoffset*2.0;int j= int( offset+ mod(col,2.0) );int i=INDEX_PATTERN[ j ];return vec3(BARYCENTRIC_VALUES[i],mod(col+lineoffset,2.0) ) ;}varying vec2 vBarys;#if defined(WIREFRAME_SQUARE) && defined(WIREFRAME_EDGE_WEIGHT)
varying float vEdgeWeight;#endif
`;
ShaderStore.IncludesShadersStore["wireframe_vertex_decl"] = shader;
/** @internal */ export const wireframe_vertex_decl = { name, shader };