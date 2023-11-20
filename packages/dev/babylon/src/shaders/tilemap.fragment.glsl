precision highp float;

#include<lightFragmentDeclaration>
#include<materialFragmentDeclaration>
#include<clipFragmentDeclaration>


// Varying
in vec3 vNormal;
in vec3 vUvs;
in vec3 vUvsElevation;

// Uniforms
uniform DirLight light;
uniform Material material;
uniform highp sampler2DArray layer;
uniform highp sampler2DArray altitudes;
uniform vec4 backColor;

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
    if(vUvs.z < 0.0 ) {
        /*float alt0 = float(texture(altitudes, vUvsElevation))  ;
        float minorInterval = 100.0;
        float tolerance = 2.0;
        float minorLines = mod(alt0, minorInterval);

        if (minorLines < tolerance) {
            vec3 contourColor = vec3(0.11, 0.75, 0.81); 
            // Proche d'une isoligne
            glFragColor = vec4(contourColor, 1.0);
        } else {
            vec3 black = vec3(0.0, 0.0, 0.0); 
            glFragColor = vec4(black, 1.0);
        }*/
        glFragColor = backColor;
        return ;
    }
    glFragColor = texture(layer, vUvs) ;
}