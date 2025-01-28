precision highp float;

// babylon specific
#include<instancesDeclaration>

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// this is related to elevations and normals
#include<elevationVertexDeclaration>

// this is related to texture
#include<textureVertexDeclaration>

// Attributes
in vec3 position;
in vec2 uv;
// Uniforms
uniform mat4 viewProjection;



void main(void) {
    vec3 v = vec3(uv.xy, 0.0);

    // babylon specific which give you the finalWorld matrix
    #include<instancesVertex>

    // get the position
    float alt = 0.0;
    vec4 pos = vec4(position.xy, alt, 1.0);
    vec4 worldPosition = finalWorld * pos;
    
    // clip map
    #include<clipVertex>
    
    gl_Position = viewProjection * worldPosition;
    
    vUvs = (- position.xy + 0.5); 
    depth =  textureDepths.x;
}