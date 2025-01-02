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

    // Step 1: Sample UVs
    v.z = depths.z; // The UV depth is stored in depths.z
    vUvs = v.z < 0.0 ? uv : texture(uSurfaceUvs, v).xy; // Sample UVs if depth is valid

    // Step 2: Sample Surface ID
    v.z = depths.w; // The surface ID depth is stored in depths.w
    vId = v.z < 0.0 ? 0 : int(texture(uSurfaceIds, v).x); // Sample ID if depth is valid
}