// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "elevationDeclaration";
const shader = `vec3 elevation_rgbaToNormal(vec4 rgba) {float x=(2.0*pixel.r)-1.0;float y=(2.0*pixel.g)-1.0;float z=(pixel.b*255.0-128.0)/127.0;return vec3(x,z,y); }`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const elevationDeclaration = { name, shader };