// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "dummy";
const shader = `uniform highp Sampler2DArray u_altitudeSampler;in float neighbours_indices[4];in vec3 tex_coordinates;main(){float i=neighbours_indices[tex_coordinates.z];vec3 v=vec3(tex_coordinates.xy,i);if( i<0) {v.x=v.x != 0.0 ? v.x : 1.0;v.y=v.y != 0.0 ? v.y : 1.0; v.z=0.0;} float altitude=float(texture(u_altitudeSampler,tex_coordinates));}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const dummy = { name, shader };