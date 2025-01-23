precision highp float;

// babylon specific
#include<instancesDeclaration>

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// Attributes
in vec3 position;
in vec2 uv;
// Uniforms
uniform mat4 viewProjection;

#include<textureDepthVertexDeclaration>

void main(void) {
    // babylon specific which give you the finalWorld matrix
    #include<instancesVertex>

    // get the position
    float alt = 0.0;
    vec4 pos = vec4(position.xy, alt, 1.0);
    vec4 worldPosition = finalWorld * pos;
    
    // clip map
    #include<clipVertex>
    
    gl_Position = viewProjection * worldPosition;

    vUvs = vec2(1.0-uv.x, uv.y);
    depth =  textureDepths.x;
}