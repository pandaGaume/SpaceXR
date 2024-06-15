#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING) 
    #include<lightDefinition>
    #include<lightCommonsDeclaration>
    #if defined(FLAT_SHADING)
        flat out vec4 vColor;
    #else
        out vec4 vColor;
    #endif 
#elif defined(PHONG_SHADING) || defined(BLINN_PHONG_SHADING)
    out vec3 vNormal;
    out vec3 vPosition;
#endif