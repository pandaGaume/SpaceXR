
    // ellipsoid
    struct Ellipsoid {
        float _a;
        float _ee;
        float _p1mee;
    };
    
    vec4 toECEF(Ellipsoid ref, vec3 geo) 
    {
        float sin_lambda = sin(geo.y);
        float cos_lambda = cos(geo.y);
        float cos_phi = cos(geo.x);
        float sin_phi = sin(geo.x);
        float N = ref._a / sqrt(1.0 - ref._ee * sin_lambda * sin_lambda);
        float tmp = (geo.z + N) * cos_lambda;
        float x = tmp * cos_phi;
        float y = tmp * sin_phi;
        float z = (geo.z + ref._p1mee * N) * sin_lambda;
        return vec4(x,y,z,1.0);
    }
