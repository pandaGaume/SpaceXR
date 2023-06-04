precision highp float;

#include<light_decl>
#include<mat_decl>

// Varying
varying vec4 vPosition;
varying vec3 vNormal;

// Uniforms
uniform mat4 world;
uniform DirLight light;
uniform Material material;
uniform vec3 viewPos;

    void main(void) {
        
    // ambient
    vec3 ambient  = light.ambient * material.ambient;
    
    // diffuse 
    vec3 norm = normalize(vNormal);
    vec3 lightDir = normalize(light.direction);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse  = light.diffuse * (diff * material.diffuse);
    
    // specular
    vec3 viewDir = normalize(viewPos - vPosition.xyz);
    vec3 reflectDir = reflect(lightDir, norm);  
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    vec3 specular = light.specular * (spec * material.specular);   
        
    vec3 result = ambient + diffuse + specular;
    gl_FragColor = vec4(result, 1.0);
}