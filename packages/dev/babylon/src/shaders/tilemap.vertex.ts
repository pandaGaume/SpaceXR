// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "tilemapVertexShader";
const shader = `precision highp float;in vec3 position; in vec2 uv; in vec4 ids;#include<instancesDeclaration>
#include<clipVertexDeclaration>
uniform mat4 viewProjection; uniform highp sampler2DArray altitudes;uniform highp sampler2DArray normals;uniform highp float minAlt;uniform highp float mapscale;out vec4 vPosition;out vec3 vNormal;void main(void) {#include<instancesVertex>
float depth=ids[int(position.z)] ;vec3 v=vec3(uv.x,uv.y,depth);if( depth<0.0) {v.x=v.x != 0.0 ? v.x : 1.0;v.y=v.y != 0.0 ? v.y : 1.0; v.z=0.0;} float alt=float(texture(altitudes,v)) ;alt=(alt-minAlt)*mapscale;vPosition=vec4(position.xy,alt ,1.0) ;vec4 worldPos=finalWorld*vPosition;gl_Position=viewProjection*worldPos;vec4 pixel=texture(normals,v);float x=(2.0*pixel.r)-1.0;float y=(2.0*pixel.g)-1.0;float z=(pixel.b*255.0-128.0)/127.0;vNormal=vec3(x,z,y);#include<clipVertex>
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const tilemapVertexShader = { name, shader };