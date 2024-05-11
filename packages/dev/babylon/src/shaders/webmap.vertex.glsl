precision highp float;

// this is specific to Babylonjs
#include<instancesDeclaration>

// Uniforms
uniform mat4 viewProjection; // babylon build in

// Attributes
in vec3 position; // babylon build in
in vec2 uv; // babylon build in

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// this is the declaration of the function to compute geometry related to elevation data.
#include<elevationDeclaration>

uniform highp sampler2DArray altitudes;
uniform highp sampler2DArray normals;
uniform vec2 overallAltitudeRange;
uniform sampler2D layerIds;

in vec4 demIds; // the depth of the dem textures. ids[0] is the current, while ids[1],ids[2] and ids[3] are the neighbors
in vec3 layerAddress; // the address of the layers into the layersIds texture. ids.xy is the position into the layerIds.

// Varying
out vec4 vPosition;
out vec3 vNormal;
out vec3 vUvs;

void main(void) {
    
    // this is specific to Babylonjs
    #include<instancesVertex>

    // we choose the index using the value stored into the z of the position.
    // this value will be [0,3] to index one value into the ids vector. 
    // we assume the value is already clamped.
    float depth = demIds[int(position.z)] ;
    vec3 v = vec3(uv.xy, depth);
    if( depth < 0.0) {
        v.x = v.x == 0.0 ? 1.0 : v.x;
        v.y = v.y == 0.0 ? 1.0 : v.y;   
        v.z = demIds[0];
    } 

    float alt0 = float(texture(altitudes, v))  ;
    float alt = alt0 - overallAltitudeRange.x ;

    vPosition = vec4(position.xy, alt ,1.0) ;
    vec4 worldPos = finalWorld * vPosition;
    gl_Position = viewProjection * worldPos;

        //  To calculate the normal vector (x, y, z) from the color channel values R, G, B,
    //  it is necessary to perform the inverse operations of the transformations applied during encoding.
    //  Specifically, to retrieve the values of x, y, and z from the values of R, G, and B, the following formulas are used:
    //       x = (2 * R / 255) - 1
    //       y = (2 * G / 255) - 1
    //       z = (B - 128) / 127
    // when accessing the RawTexture in GLSL using the texture2D function, the returned values are normalized.
    // This normalization occurs because GLSL expects texture data to be in the range [0, 1]. 
    // Therefore, when you sample a RawTexture using texture2D in GLSL, the pixel values are automatically 
    // divided by the maximum possible value for the respective data type.
    // So we need to restore them to their original range by multply by 255
    vec4 pixel = texture(normals, v);
    vNormal = elevation_rgbaToNormal(pixel)
 
    // UV & Depth 
    depth = layerIds[0] ;
    vUvs = vec3(position.xy + 0.5, depth);
}