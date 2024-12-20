// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "lightCommonsDeclarationVertexShader";
const shader = `uniform vec3 uAmbientLight;uniform HemisphericLight uHemiLight;uniform PointLight uPointLights[MAX_POINT_LIGHTS];uniform SpotLight uSpotLights[MAX_SPOT_LIGHTS];uniform int uNumPointLights;uniform int uNumSpotLights;#if defined(SPECULAR)
uniform float uShininess;uniform vec3 uViewPosition;#endif
`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const lightCommonsDeclarationVertexShader = { name, shader };