// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "lightDefinition";
const shader = `struct PointLight {vec3 position;vec3 color;float intensity;};struct SpotLight {vec3 position;vec3 direction;vec3 color;float innerCutoff; float outerCutoff; float exponent; float intensity;};struct HemisphericLight {vec3 skyColor;vec3 groundColor;vec3 direction;float intensity;};#if defined(SPECULAR)
vec3 calculatePhongSpecular(vec3 normal,vec3 lightDir,vec3 viewDir,float shininess,vec3 lightColor) {vec3 reflectDir=reflect(-lightDir,normal);float spec=pow(max(dot(viewDir,reflectDir),0.0),shininess);return lightColor*spec;}vec3 calculateBlinnPhongSpecular(vec3 normal,vec3 lightDir,vec3 viewDir,float shininess,vec3 lightColor) {vec3 halfDir=normalize(lightDir+viewDir);float spec=pow(max(dot(normal,halfDir),0.0),shininess);return lightColor*spec;}#endif
vec3 calculateHemisphericLight( HemisphericLight light,vec3 normal#if defined(SPECULAR)
,vec3 viewDir,float shininess#endif 
) {vec3 nLightDir=normalize(light.direction);float hemiLightFactor= max(dot(normal,nLightDir),0.0);vec3 diffuse=mix(light.groundColor,light.skyColor,hemiLightFactor) ;#if defined(SPECULAR)
#if defined(BLINN_PHONG_SHADING)
return (diffuse+calculateBlinnPhongSpecular(normal,nLightDir,viewDir,shininess,light.skyColor))*light.intensity;#elif defined(PHONG_SHADING)
return (diffuse+calculatePhongSpecular(normal,nLightDir,viewDir,shininess,light.skyColor))*light.intensity;#endif
#endif
return diffuse*light.intensity;}vec3 calculatePointLight(PointLight light,vec3 normal, vec3 lightDir #if defined(SPECULAR)
,vec3 viewDir,float shininess #endif 
) {vec3 nLightDir=normalize(lightDir);vec3 diffuse=max(dot(normal,nLightDir),0.0)*light.color;#if defined(SPECULAR)
#if defined(BLINN_PHONG_SHADING)
return (diffuse+calculateBlinnPhongSpecular(normal,nLightDir,viewDir,shininess,light.color))*light.intensity;#elif defined(PHONG_SHADING)
return (diffuse+calculatePhongSpecular(normal,nLightDir,viewDir,shininess,light.color))*light.intensity;#endif
#endif
return diffuse*light.intensity;}vec3 calculateSpotLight(SpotLight light,vec3 normal, vec3 lightDir #if defined(SPECULAR)
,vec3 viewDir,float shininess #endif 
) {float attenuation=max(0.,1.0-length(lightDir)/light.exponent);vec3 nLightDir=normalize(lightDir);float theta=dot(nLightDir,normalize(-light.direction));float epsilon=light.innerCutoff-light.outerCutoff;float intensity=clamp((theta-light.outerCutoff)/epsilon,0.0,1.0);intensity=pow(intensity,2.0)*attenuation; vec3 diffuse=light.color*max(dot(normal,nLightDir),0.0) ;#if defined(SPECULAR)
#if defined(BLINN_PHONG_SHADING)
return (diffuse+calculateBlinnPhongSpecular(normal,nLightDir,viewDir,shininess,light.color))*light.intensity*intensity;#elif defined(PHONG_SHADING)
return (diffuse+calculatePhongSpecular(normal,nLightDir,viewDir,shininess,light.color))*light.intensity*intensity;#endif
#endif
return diffuse*light.intensity*intensity;}#ifndef MAX_POINT_LIGHTS
#define MAX_POINT_LIGHTS 3
#endif
#ifndef MAX_SPOT_LIGHTS
#define MAX_SPOT_LIGHTS 3
#endif
vec3 calculateLight(vec3 ambient,HemisphericLight hemispheric,PointLight pointlights[MAX_POINT_LIGHTS],int countPointLights,SpotLight spotLights[MAX_SPOT_LIGHTS],int countSpotLights,vec3 normal,vec3 pos#if defined(SPECULAR)
,vec3 viewPos,float shininess#endif 
){#if defined(SPECULAR)
vec3 viewDir=normalize(viewPos-pos);vec3 color=calculateHemisphericLight(hemispheric,normal,viewDir,shininess);#else
vec3 color=calculateHemisphericLight(hemispheric,normal);#endif
for (int i=0; i<countPointLights; i++) {vec3 lightDir=pointlights[i].position-pos;#if defined(SPECULAR)
vec3 lightColor=calculatePointLight(pointlights[i],normal,lightDir,viewDir,shininess);#else
vec3 lightColor=calculatePointLight(pointlights[i],normal,lightDir);#endif
color+=lightColor;}for (int i=0; i<countSpotLights; i++) {vec3 lightDir=spotLights[i].position-pos;#if defined(SPECULAR)
vec3 lightColor=calculateSpotLight(spotLights[i],normal,lightDir,viewDir,shininess);#else
vec3 lightColor=calculateSpotLight(spotLights[i],normal,lightDir);#endif
color+=lightColor;}return clamp(color+ambient,0.0,1.0);}`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const lightDefinition = { name, shader };