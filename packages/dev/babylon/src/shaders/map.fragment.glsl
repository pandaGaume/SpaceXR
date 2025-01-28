precision highp float;

// declare the varying for clipping
#include<clipFragmentDeclaration>

#include<textureFragmentDeclaration>

void main(void) {
     
     // test is the fragment is inside the clip map
     #include<clipFragment>
     
     gl_FragColor = texture(uTextures, vec3(vUvs, depth));
}