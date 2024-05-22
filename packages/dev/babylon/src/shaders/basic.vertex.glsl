precision highp float;

// this is specific to Babylonjs
#include<instancesDeclaration>

// Attributes
attribute vec3 position;

// Uniforms
uniform mat4 viewProjection;

void main(void) {
    #include<instancesVertex>
    // warning !! finalWorld is the matrix to use with instances.
    vec4 worldPosition = finalWorld * vec4(position, 1.0);
    gl_Position = viewProjection * worldPosition;
}