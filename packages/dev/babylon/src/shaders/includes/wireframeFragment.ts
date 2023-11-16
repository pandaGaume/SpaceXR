// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "wireframeFragment";
const shader = `if( edgeThickness != 0.0 ) {gl_FragColor=mix(edgeColor,gl_FragColor,edgeFactor(vBarys,edgeThickness));}`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const wireframeFragment = { name, shader };