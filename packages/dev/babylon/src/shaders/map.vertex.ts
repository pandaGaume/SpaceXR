// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "mapVertexShader";
const shader = `precision highp float;#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<elevationVertexDeclaration>
#include<textureVertexDeclaration>
in vec3 position;in vec2 uv;uniform mat4 viewProjection;void main(void) {int i=int(position.z);float elevationDepth=elevationDepths[i];vec3 v=vec3(elevationUvs.xy+uv.xy*elevationUvs.zw,elevationDepth);#include<instancesVertex>
float rawAltitude=float(texture(uElevations,v));float alt=(rawAltitude -uAltRange.x)*uMapScale;vec4 pos=vec4(position.xy,alt,1.0);vec4 worldPosition=finalWorld*pos;#include<clipVertex>
gl_Position=viewProjection*worldPosition;vUvs=(- position.xy+0.5); depth= textureDepths.x;}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const mapVertexShader = { name, shader };