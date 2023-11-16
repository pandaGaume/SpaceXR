    vec3 tmp = barycentricWeight(gl_VertexID, altitudesSize);
    vBarys = tmp.xy ;
    vEdgeWeight = tmp.z;

