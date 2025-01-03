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

out vec2 vUvs;
flat out int vId;
flat out vec3 vColor;

void main(void) {
    int i = int(position.z);
    if( i == 0)
    {
        vColor = vec3(1.0, 1.0, 1.0);
    }
    else if( i == 1)
    {
        vColor = vec3(1.0, 0.0, 0.0);
    }
    else if( i == 2)
    {
        vColor = vec3(0.0, 1.0, 0.0);
    }
    else
    {
        vColor = vec3(0.0, 0.0, 1.0);
    }

    // we choose the index using the value stored into the z of the position.
    // this value will be [0,3] to index one value into the ids vector. 
    // we assume the value is already clamped.
    float depth = elevationDepths[i];

    vec3 v = vec3(uv.xy, depth);
    if( depth < 0.0)
    {
        // we are in the case of a border vertex
        v.x = v.x == 0.0 ? 1.0 : v.x;
        v.y = v.y == 0.0 ? 1.0 : v.y; 
        v.z = depth = elevationDepths[0];
    }

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

    // Step 1: Sample UVs
    v.z = textureDepths.x; // The UV depth is stored in textureDepths.x
    vUvs = v.z < 0.0 ? uv : texture(uSurfaceUvs, v).xy; // Sample UVs if depth is valid

    // Step 2: Sample Surface ID
    v.z = textureDepths.y; // The surface ID depth is stored in textureDepths.y
    vId = v.z < 0.0 ? 0 : int(texture(uSurfaceIds, v).x); // Sample ID if depth is valid
}