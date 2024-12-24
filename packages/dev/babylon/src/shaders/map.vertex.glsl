precision highp float;

// babylon specific
#include<instancesDeclaration>

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// this is the declaration of the function to compute geometry related to elevation data.
#include<elevationVertexDeclaration>

// Attributes
in vec3 position;
in vec2 uv;
// Uniforms
uniform mat4 viewProjection;


void main(void) {

    vec3 v = vec3(uv.xy, depths.x);

    // babylon specific which give you the finalWorld matrix
    #include<instancesVertex>

    // get the position
    float rawAltitude = float(texture(uAltitudes, v));
    float alt = (rawAltitude -uAltRange.x) * uMapScale;
    vec4 pos = vec4(position.xy, alt, 1.0);
    vec4 worldPosition = finalWorld * pos;
    
    // clip map
    #include<clipVertex>
    
    gl_Position = viewProjection * worldPosition;
}