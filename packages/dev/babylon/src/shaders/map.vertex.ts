// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "mapVertexShader";
const shader = `precision highp float;#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<elevationVertexDeclaration>
in vec3 position;in vec2 uv;uniform mat4 viewProjection;out vec2 vUvs;flat out int vId;void main(void) {vec3 v=vec3(uv.xy,depths.x);#include<instancesVertex>
float rawAltitude=float(texture(uAltitudes,v));float alt=(rawAltitude -uAltRange.x)*uMapScale;vec4 pos=vec4(position.xy,alt,1.0);vec4 worldPosition=finalWorld*pos;#include<clipVertex>
gl_Position=viewProjection*worldPosition;v.z=depths.z; vUvs=v.z<0.0 ? uv : texture(uSurfaceUvs,v).xy; v.z=depths.w; vId=v.z<0.0 ? 0 : int(texture(uSurfaceIds,v).x); }`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const mapVertexShader = { name, shader };