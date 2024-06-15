precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;

// Uniforms
uniform mat4 worldViewProjection;

// Varying
varying vec4 vPosition;
varying vec3 vNormal;

void main(void) {

    vPosition = vec4(position,1.0);
    vec4 outPosition = worldViewProjection * vPosition ;
    gl_Position = outPosition;

    vNormal = normal; 
}