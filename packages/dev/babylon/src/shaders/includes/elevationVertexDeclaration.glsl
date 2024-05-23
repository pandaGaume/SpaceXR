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
vec3 elevation_rgbaToNormal(vec4 rgba) {
    float x = (2.0 * rgba.r) - 1.0;
    float y = (2.0 * rgba.g) - 1.0;
    float z = (rgba.b * 255.0 - 128.0) / 127.0;
    return vec3(x,z,y);    
}

uniform highp sampler2DArray uAltitudes;
uniform highp sampler2DArray uNormals;
uniform highp vec2 uAltRange;
uniform highp float uMapScale;
    
in vec4 demIds; // the depth of the dem textures. ids[0] is the current, while ids[1],ids[2] and ids[3] are the neighbors
