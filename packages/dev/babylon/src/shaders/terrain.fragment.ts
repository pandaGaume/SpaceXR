// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";

const terrainFragmentShader = `precision highp float;#if defined(WIREFRAME) || defined(WIREFRAME_SQUARE)
#include<wireframe_fragment_decl>
#endif
varying vec4 vPosition;varying vec3 vNormal;uniform mat4 world;uniform vec3 lightPosition;uniform vec3 color;uniform vec4 edgeColor ;void main(void) {vec3 positionW=vec3(world*vPosition);vec3 normalW=normalize(vec3(world*vec4(vNormal,0.0)));vec3 lightVectorW=normalize(lightPosition-positionW);float ndl=max(0.,dot(normalW,lightVectorW));gl_FragColor=vec4(color*ndl ,1.);#if defined(WIREFRAME) || defined(WIREFRAME_SQUARE)
if( edgeThickness != 0.0 #if defined(WIREFRAME_SQUARE) && defined(WIREFRAME_EDGE_WEIGHT) 
&& (vEdgeWeight<=edgeVisibilityRange.x || vEdgeWeight>=edgeVisibilityRange.y ) #endif
) {gl_FragColor=mix(edgeColor,gl_FragColor,edgeFactor(vBarys,edgeThickness));}#endif 
}`;
ShaderStore.ShadersStore["terrainFragmentShader"] = terrainFragmentShader;
