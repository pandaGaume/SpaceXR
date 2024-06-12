// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "webmapFragmentShader";
const shader = `#include<lightFragmentDeclaration>
#include<clipFragmentDeclaration>
#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
uniform vec4 uTerrainColor;#endif
uniform highp sampler2DArray uTextures;in vec3 vUvs;void main(void) {#include<clipFragment>
#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
vec4 texColor=texture(uTextures,vUvs);#endif
#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
gl_FragColor=vColor;#elif defined(PHONG_SHADING) || defined(BLINN_PHONG_SHADING)
#if defined(SPECULAR)
vec3 lightColor=calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,normalize(vNormal),vPosition,uViewPosition,uShininess);#else
vec3 lightColor= calculateLight(uAmbientLight,uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights,normalize(vNormal),vPosition);#endif
gl_FragColor= texColor;#endif
}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const webmapFragmentShader = { name, shader };