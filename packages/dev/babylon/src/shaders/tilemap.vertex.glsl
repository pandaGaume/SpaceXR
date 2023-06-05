precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;
#include<instancesDeclaration>
#include<clipVertexDeclaration>

// Uniforms
uniform mat4 viewProjection;

// Varying
varying vec4 vPosition;
varying vec3 vNormal;

void main(void) {
    #include<instancesVertex>
    vPosition = vec4(position,1.0);
    vec4 worldPos = finalWorld * vPosition ;
    vec4 outPosition = viewProjection * worldPos ;
    gl_Position = outPosition;

    vNormal = normal; 
    #include<clipVertex>
}