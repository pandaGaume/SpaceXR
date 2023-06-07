precision highp float;

// Attributes
attribute vec3 position;
#include<instancesDeclaration>
#include<clipVertexDeclaration>
#include<demVertexDeclaration>

// Uniforms
uniform mat4 viewProjection;
uniform sampler2D altitudes;
uniform sampler2D normals;

// Varying
varying vec4 vPosition;
varying vec3 vNormal;

void main(void) {
    #include<instancesVertex>
    float x = (position.x + .5);
    float y = (position.y + .5);
    vec2 uv = vec2(x,y);
    float alt = float(texture2D(altitudes, uv )) ;
    float z = ((alt - demInfos.min.z)/ demInfos.delta) * 10.0 ;

    vPosition = vec4(position.xy, z ,1.0) ;
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
    
    vec4 pixel = texture2D(normals, uv );
    x = (2.0 * pixel.r) - 1.0;
    y = (2.0 * pixel.g) - 1.0;
    z = (pixel.b * 255.0 - 128.0) / 127.0;
    vNormal = vec3(x,y,z);
    
    #include<clipVertex>
}