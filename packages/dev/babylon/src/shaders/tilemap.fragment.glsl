precision highp float;

#include<clipFragmentDeclaration>

#if defined(WIREFRAME)
    #include<wireframeFragmentDeclaration>
#endif

// Varying
in vec3 vNormal;
in vec3 vUvs;

// Uniforms
uniform highp sampler2DArray layer;
uniform highp sampler2DArray altitudes;
uniform vec4 backColor;

void main(void) {

   #include<clipFragment>

   #if defined(WIREFRAME)
    #include<wireframeFragment>
   #else
    if(vUvs.z < 0.0 ) {
        glFragColor = backColor;
        return ;
    }
    glFragColor = texture(layer, vUvs) ;
   #endif        
}