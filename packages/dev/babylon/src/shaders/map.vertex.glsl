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

// Uniforms
uniform mat4 viewProjection;

void main(void) {

    int i = int(position.z);
    float elevationDepth = elevationDepths[i];
    vec2 uv0 = (- position.xy + 0.5);
    vec2 tmp = (i != 0 && elevationDepth != elevationDepths[0]) ? vec2(uv0.x == 1.0 ? 0.0 : uv0.x, uv0.y == 1.0 ? 0.0 : uv0.y) : uv0;
    vec3 v = vec3(elevationUvs.xy + tmp.xy * elevationUvs.zw, elevationDepth);

    // babylon specific which give you the finalWorld matrix
    #include<instancesVertex>

    // get the position
    float rawAltitude = float(texture(uElevations, v));
    float alt = (rawAltitude -uAltRange.x) * uMapScale;
    vec4 pos = vec4(position.xy, alt, 1.0);
    vec4 worldPosition = finalWorld * pos;
    
    // clip map
    #include<clipVertex>
    
    gl_Position = viewProjection * worldPosition;
    
    vUvs = uv0; 
    depth = textureDepths.x;
}