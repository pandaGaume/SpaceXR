precision highp float;

#if defined(WIREFRAME) || defined(WIREFRAME_SQUARE)
    #include<wireframe_fragment_decl>
#endif

    // Varying
    varying vec4 vPosition;
    varying vec3 vNormal;
 
    // Uniforms
    uniform mat4 world;
    uniform vec3 lightPosition;
 
    uniform vec3 color;
    uniform vec4 edgeColor ;

    void main(void) {
        // World values
        vec3 positionW = vec3(world * vPosition);
        vec3 normalW = normalize(vec3(world * vec4(vNormal, 0.0)));
        
        // Light
        vec3 lightVectorW = normalize(lightPosition - positionW);
       
        // diffuse
        float ndl = max(0., dot(normalW, lightVectorW));
    
        gl_FragColor = vec4(color * ndl , 1.);

#if defined(WIREFRAME) || defined(WIREFRAME_SQUARE)
        if( edgeThickness != 0.0 
#if defined(WIREFRAME_SQUARE) && defined(WIREFRAME_EDGE_WEIGHT) 
            && (vEdgeWeight <= edgeVisibilityRange.x || vEdgeWeight >= edgeVisibilityRange.y ) 
#endif
        ) {
            gl_FragColor = mix(edgeColor, gl_FragColor, edgeFactor(vBarys,edgeThickness));
        }
#endif    
}