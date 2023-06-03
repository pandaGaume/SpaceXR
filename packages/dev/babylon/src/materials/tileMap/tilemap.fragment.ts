// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";

const tilemapFragmentShader = `precision highp float;varying vec4 vPosition;varying vec3 vNormal;varying float fClipDistance;uniform mat4 world;uniform vec3 lightPosition;uniform vec3 terrainColor;void main(void) {if (fClipDistance.x>0.0 || fClipDistance.y>0.0 || fClipDistance.z>0.0 || fClipDistance.w>0.0){discard;}vec3 positionW=vec3(world*vPosition);vec3 normalW=normalize(vec3(world*vec4(vNormal,0.0)));vec3 lightVectorW=normalize(lightPosition-positionW);float ndl=max(0.,dot(normalW,lightVectorW));gl_FragColor=vec4(terrainColor*ndl ,1.); }`;
ShaderStore.ShadersStore["tilemapFragmentShader"] = tilemapFragmentShader;
