precision highp float;

#include<lightFragmentDeclaration>
#include<materialFragmentDeclaration>
#include<clipFragmentDeclaration>


// Varying
varying vec4 vPosition;
varying vec3 vNormal;

// Uniforms
uniform DirLight light;
uniform Material material;

void main(void) {

    #include<clipFragment>
        
    // ambient
    vec3 ambient  = light.ambient * material.ambient;
    
    // diffuse 
    vec3 norm = normalize(vNormal);
    float diff = max(dot(norm, light.direction), 0.0);
    vec3 diffuse  = light.diffuse * (diff * material.diffuse);
       
    vec3 result = ambient + diffuse ;
    gl_FragColor = vec4(result,1.0) ;
}