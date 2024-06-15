
    #define Z_WEIGHT(b) 1.0
    
    float edgeFactor(vec2 w, float thickness){
        vec3 b = vec3(w, Z_WEIGHT(w));
        vec3 d = fwidth(b);
        vec3 a3 = smoothstep(vec3(0.0), d * thickness, b);
        return min(min(a3.x, a3.y), a3.z);
    }

    uniform float edgeThickness;
    uniform vec4 edgeColor;
    
    varying float vEdgeWeight;
    varying vec2 vBarys;