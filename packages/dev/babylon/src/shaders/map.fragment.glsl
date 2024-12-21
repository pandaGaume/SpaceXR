precision highp float;

// declare the varying for clipping
#include<clipFragmentDeclaration>

void main(void) {
     
     // test is the fragment is inside the clip map
     #include<clipFragment>
     
     gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White wireframe color
}