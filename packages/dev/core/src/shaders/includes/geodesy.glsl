// ellipsoid
    struct Ellipsoid {
        float _a;
        float _ee;
        float _p1mee;
    };
    
    vec4 toECEF(Ellipsoid ref, vec4 trigo, float alt) 
    {
        float sin_lambda = trigo.x;
        float cos_lambda = trigo.y;
        float sin_phi = trigo.z;
        float cos_phi = trigo.w;
        // optimization note : we can add N to the latitude trigonometric lookup table as third parameter.
        float N = ref._a / sqrt(1.0 - ref._ee * sin_lambda * sin_lambda);
        float tmp = (alt + N) * cos_lambda;
        float x = tmp * cos_phi;
        float y = tmp * sin_phi;
        float z = (alt + ref._p1mee * N) * sin_lambda;
        return vec4(x,y,z,1.0);
    }

    uniform Ellipsoid ellipsoid;
    uniform mat4 enuTransform;

    uniform sampler2D altitudes;
    uniform sampler2D lonLT;
    uniform sampler2D latLT;
