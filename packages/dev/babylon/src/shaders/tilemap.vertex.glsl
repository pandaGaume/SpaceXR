precision highp float;

// Attributes
in vec3 position;
in vec4 demInfos;
in vec2 textureIds;

#include<instancesDeclaration>
#include<clipVertexDeclaration>

// Uniforms
uniform mat4 viewProjection;
uniform highp sampler2DArray altitudes;
uniform highp sampler2DArray normals;
uniform highp float minAlt;

// Varying
out vec4 vPosition;
out vec3 vNormal;
out vec2 vUv;
out float aDepth;

void main(void) {
    #include<instancesVertex>
    float x = max(position.x + .5, 0.01) ;
    float y = position.y + .5 ;
    vec2 uv = vec2(x,y);
    float alt = float(texture(altitudes, vec3(uv,textureIds.x) )) ;
    // float alt = y < 0.0 || y > 1.0 ? demInfos.y : float(texture(altitudes, vec3(uv,textureIds.x) )) ;
    // todo : revisit the formula as this one is for individual tile and did not keep the scale...
    // float z = ((alt - demInfos.x)/ demInfos.z) * 10.0 ;
    float z = (alt - minAlt) * 0.01;

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
    
    vec4 pixel = texture(normals, vec3(uv,textureIds.y) );
    x = (2.0 * pixel.r) - 1.0;
    y = (2.0 * pixel.g) - 1.0;
    z = (pixel.b * 255.0 - 128.0) / 127.0;
    vNormal = vec3(x,z,y);
    vUv = uv;
    aDepth = textureIds.y;

    #include<clipVertex>
}