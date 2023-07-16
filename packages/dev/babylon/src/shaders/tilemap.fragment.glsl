precision highp float;

#include<lightFragmentDeclaration>
#include<materialFragmentDeclaration>
#include<clipFragmentDeclaration>


// Varying
in vec3 vNormal;
in vec3 vUvs;

// Uniforms
uniform DirLight light;
uniform Material material;
uniform highp sampler2DArray layer;

void main(void) {

    #include<clipFragment>
        
    // ambient
    // vec3 ambient  = light.ambient * material.ambient;
    
    // diffuse 
    // vec3 norm = normalize(vNormal);
    // float diff = max(dot(norm, light.direction), 0.0);
    // vec3 diffuse  = light.diffuse * (diff * material.diffuse);
       
    // vec3 result = ambient + diffuse ;
    // glFragColor = vec4(result,1.0) ;
    
    
    glFragColor = texture(layer, vUvs) ;

}