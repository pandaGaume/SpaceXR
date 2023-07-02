
uniform highp Sampler2DArray u_altitudeSampler;
in float neighbours_indices[4];
in vec3 tex_coordinates;

main(){
    
    float i = neighbours_indices[tex_coordinates.z];
    vec3 v = vec3(tex_coordinates.xy, i);
    if( i < 0) {
        v.x = v.x != 0.0 ? v.x : 1.0;
        v.y = v.y != 0.0 ? v.y : 1.0;   
        v.z = 0.0;
    } 
    float altitude = float(texture(u_altitudeSampler,tex_coordinates));
}
