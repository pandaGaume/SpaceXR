struct DemInfos {
    vec3 max;
    vec3 min;
    float delta;
    float mean;
    sampler2D elevations;
    sampler2D normals;
};

uniform DemInfos demInfos;
