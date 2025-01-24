// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "ellipsoidVertexDeclaration";
const shader = `const float oneOver2PI=0.15915494309189533576888;const float oneOverPI =0.31830988618379067153777;struct Ellipsoid {float _a;float _ee;float _p1mee;};vec4 toECEF(Ellipsoid ref,vec3 geo) {float sin_lambda=sin(geo.y);float cos_lambda=cos(geo.y);float cos_phi=cos(geo.x);float sin_phi=sin(geo.x);float N=ref._a/sqrt(1.0-ref._ee*sin_lambda*sin_lambda);float tmp=(geo.z+N)*cos_lambda;float x=tmp*cos_phi;float y=tmp*sin_phi;float z=(geo.z+ref._p1mee*N)*sin_lambda;return vec4(x,z,y,1.0);}uniform Ellipsoid ellipsoid;`;
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */ export const ellipsoidVertexDeclaration = { name, shader };