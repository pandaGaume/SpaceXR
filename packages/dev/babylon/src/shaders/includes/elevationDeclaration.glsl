
vec3 elevation_rgbaToNormal(vec4 rgba) {
    float x = (2.0 * pixel.r) - 1.0;
    float y = (2.0 * pixel.g) - 1.0;
    float z = (pixel.b * 255.0 - 128.0) / 127.0;
    return vec3(x,z,y);    
}
    