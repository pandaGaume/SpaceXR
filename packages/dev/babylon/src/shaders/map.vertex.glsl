precision highp float;

// babylon specific
#include<instancesDeclaration>

// Attributes
in vec3 position;

// Uniforms
uniform mat4 viewProjection;


void main(void) {
    #include<instancesVertex>

    vec4 pos = vec4(position.xyz, 1.0);
    vec4 worldPosition = finalWorld * pos;

    gl_Position = viewProjection * worldPosition;
}