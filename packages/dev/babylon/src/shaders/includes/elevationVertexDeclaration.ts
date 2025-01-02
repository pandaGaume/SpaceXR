// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "elevationVertexDeclaration";
const shader = `vec3 elevation_rgbaToNormal(vec4 rgba){float x=(2.0*rgba.r)-1.0;float y=(2.0*rgba.g)-1.0;float z=(rgba.b*255.0-128.0)/127.0;return normalize(vec3(x,y,z));}uniform highp sampler2DArray uAltitudes;uniform highp sampler2DArray uNormals;uniform mediump isampler2DArray uSurfaceIds; uniform highp sampler2DArray uSurfaceUvs; uniform highp vec2 uAltRange;uniform highp float uMapScale;in vec4 depths;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const elevationVertexDeclaration = { name, shader };