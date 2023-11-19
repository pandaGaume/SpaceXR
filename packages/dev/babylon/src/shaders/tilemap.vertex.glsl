precision highp float;

// Attributes
in vec3 position; // babylon build in
in vec2 uv; // babylon build in

in vec4 demIds; // the depth of the dem textures. ids[0] is the current, while ids[1],ids[2] and ids[3] are the neighbors
in vec4 layerIds; // the depth of the layer textures. ids[0] is the current, while ids[1],ids[2] and ids[3] are the neighbors

// wireframe support
#if defined(WIREFRAME)
    #include<wireframeVertexDeclaration>
#endif

// this is specific to Babylonjs
#include<instancesDeclaration>

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// Uniforms
uniform mat4 viewProjection; // babylon build in

uniform highp sampler2DArray altitudes;
uniform highp sampler2DArray normals;
uniform highp float minAlt;
uniform highp float mapscale;
uniform highp float exageration;

// Varying
out vec4 vPosition;
out vec3 vNormal;
out vec3 vUvs;

void main(void) {
    
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
    float alt = (alt0 - minAlt) * mapscale * exageration;

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
    float x = (2.0 * pixel.r) - 1.0;
    float y = (2.0 * pixel.g) - 1.0;
    float z = (pixel.b * 255.0 - 128.0) / 127.0;
    vNormal = vec3(x,z,y);
 
    depth = layerIds[0] ;
    vUvs = vec3(position.xy + 0.5, depth);

    #include<clipVertex>

#if defined(WIREFRAME)
    #include<wireframeVertex>
#endif
}