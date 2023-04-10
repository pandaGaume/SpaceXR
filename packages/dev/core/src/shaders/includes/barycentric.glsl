    const vec2 BARYCENTRIC_VALUES[3] = vec2[](
        vec2(1.0, 0.0), 
        vec2(0.0, 1.0), 
        vec2(0.0, 0.0) 
    );

#ifdef WIREFRAME_SQUARE
    const int INDEX_PATTERN [4] = int[](1,2,2,0);
    vec2 barycentricWeight(v){
        float vertexIndex = float(v);
        float line = mod(floor(vertexIndex / dim.x),2.0) ; // x is width, y is height
        int j =  int( line * 2.0 + mod(vertexIndex+line,2.0) );
        int i = INDEX_PATTERN[ j ];
        return BARYCENTRIC_VALUES[i] ;
    }
    
    #define AlternateWeight(v) mod(float(v),2.0)
    #define z_weight(b) 1.0
#else    
    vec2 barycentricWeight(v){
        float vertexIndex = float(v);
        float line = floor(vertexIndex / dim.x) ; // x is width, y is height
        int i = int(mod(line+vertexIndex,3.0));
        return BARYCENTRIC_VALUES[i] ;
    }
    #define z_weight(b) 1.0- b.x - b.y
#endif


    float edgeFactor(vec2 w,float thickness){
        vec3 b = vec3(w,z_weight(w));
        vec3 d = fwidth(b);
        vec3 a3 = smoothstep(vec3(0.0), d * thickness, b);
        return min(min(a3.x, a3.y), a3.z);
    }
