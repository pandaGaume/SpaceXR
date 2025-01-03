// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "mapVertexShader";
const shader = `precision highp float;#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<elevationVertexDeclaration>
in vec3 position;in vec2 uv;uniform mat4 viewProjection;out vec2 vUvs;flat out int vId;flat out vec3 vColor;void main(void) {int i=int(position.z);if( i==0){vColor=vec3(1.0,1.0,1.0);}else if( i==1){vColor=vec3(1.0,0.0,0.0);}else if( i==2){vColor=vec3(0.0,1.0,0.0);}else{vColor=vec3(0.0,0.0,1.0);}float depth=elevationDepths[i];vec3 v=vec3(uv.xy,depth);if( depth<0.0){v.x=v.x==0.0 ? 1.0 : v.x;v.y=v.y==0.0 ? 1.0 : v.y; v.z=depth=elevationDepths[0];}#include<instancesVertex>
float rawAltitude=float(texture(uAltitudes,v));float alt=(rawAltitude -uAltRange.x)*uMapScale;vec4 pos=vec4(position.xy,alt,1.0);vec4 worldPosition=finalWorld*pos;#include<clipVertex>
gl_Position=viewProjection*worldPosition;v.z=textureDepths.x; vUvs=v.z<0.0 ? uv : texture(uSurfaceUvs,v).xy; v.z=textureDepths.y; vId=v.z<0.0 ? 0 : int(texture(uSurfaceIds,v).x); }`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const mapVertexShader = { name, shader };