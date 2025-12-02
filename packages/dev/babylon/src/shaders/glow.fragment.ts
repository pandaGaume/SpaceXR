// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "glowPixelShader";
const shader = `precision highp float;varying vec2 vUV;uniform float time;void main(void) {float glow=sin(vUV.x*20.0+time)*0.5+0.5;vec3 neonColor=vec3(0.0,0.5,1.0);float distToCenter=abs(vUV.y-0.5);float edgeFade=1.0-smoothstep(0.0,0.5,distToCenter);gl_FragColor=vec4(neonColor*glow,edgeFade);}`;
ShaderStore.ShadersStore[name] = shader;
/** @internal */ export const glowPixelShader = { name, shader };