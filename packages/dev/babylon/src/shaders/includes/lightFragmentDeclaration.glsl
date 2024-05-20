#if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
    #include<lightDefinition>
    #include<lightCommonsDeclaration>
    
    in vec3 vNormal;
    in vec3 vPosition;
#elif defined(FLAT_SHADING) 
    flat in vec4 vColor;
#elif defined(GOUREAUD_SHADING)
    in vec4 vColor;
#endif