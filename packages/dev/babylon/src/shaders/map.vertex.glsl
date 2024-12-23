precision highp float;

// babylon specific
#include<instancesDeclaration>

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// this is the declaration of the function to compute geometry related to elevation data.
#include<elevationVertexDeclaration>

// Attributes
in vec3 position;

// Uniforms
uniform mat4 viewProjection;


void main(void) {

    // babylon specific which give you the finalWorld matrix
    #include<instancesVertex>

    vec4 pos = vec4(position.xyz, 1.0);
    vec4 worldPosition = finalWorld * pos;
    
    // clip map
    #include<clipVertex>
    
    gl_Position = viewProjection * worldPosition;
}