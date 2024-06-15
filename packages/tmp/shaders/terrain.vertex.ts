// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "terrainVertexShader";
const shader = `precision highp float;#if defined(WIREFRAME) || defined(WIREFRAME_SQUARE) 
#include<wireframe_vertex_decl>
#endif
#include<geodesy>
attribute vec3 position;attribute vec3 normal;uniform mat4 worldViewProjection;varying vec4 vPosition;varying vec3 vNormal;void main(void) {vec2 uv=vec2(position.x+.5,position.y+.5);float alt=float(texture2D(altitudes,uv )) ;ivec2 altitudesSize =textureSize(altitudes,0);float vertexIndex=float(gl_VertexID);float w=float(altitudesSize.x);float line=floor(vertexIndex/w) ; float col=mod(vertexIndex,w);vec4 latTrigo=texture2D(latLT,vec2(1.-uv.y,0.));vec4 lonTrigo=texture2D(lonLT,vec2(uv.x,0.));vec4 p=enuTransform*toECEF(ellipsoid,vec4(latTrigo.xy,lonTrigo.xy),alt);vPosition=p.xzyw;vec4 outPosition=worldViewProjection*vPosition ;gl_Position=outPosition;vNormal=normal; #if defined(WIREFRAME) || defined(WIREFRAME_SQUARE)
vec3 tmp=barycentricWeight(gl_VertexID,altitudesSize);vBarys=tmp.xy ;#endif
#if defined(WIREFRAME_SQUARE) && defined(WIREFRAME_EDGE_WEIGHT)
vEdgeWeight=tmp.z;#endif
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const terrainVertexShader = { name, shader };