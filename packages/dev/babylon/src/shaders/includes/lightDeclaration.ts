// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "lightDeclaration";
const shader = `#ifndef MAX_POINT_LIGHTS
#define MAX_POINT_LIGHTS 3
#endif
#ifndef MAX_SPOT_LIGHTS
#define MAX_SPOT_LIGHTS 3
#endif
uniform HemisphericLight uHemiLight;uniform PointLight uPointLights[MAX_POINT_LIGHTS];uniform SpotLight uSpotLights[MAX_SPOT_LIGHTS];uniform int uNumPointLights;uniform int uNumSpotLights;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const lightDeclaration = { name, shader };