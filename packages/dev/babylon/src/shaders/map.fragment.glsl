precision highp float;

// declare the varying for clipping
#include<clipFragmentDeclaration>

in vec2 vUvs;
flat in int vId;
flat in vec3 vColor;
void main(void) {
     
     // test is the fragment is inside the clip map
     #include<clipFragment>
     
     gl_FragColor = vec4(vColor,1.0); // vec4(1.0, 1.0, 1.0, 1.0); // White wireframe color
}