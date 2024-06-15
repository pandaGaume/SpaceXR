    ivec3 altitudesSize  = textureSize(altitudes, 0);
    vec3 tmp = barycentricWeight(gl_VertexID, ivec2(altitudesSize.x+1, altitudesSize.y+1));
    vBarys = tmp.xy ;
    vEdgeWeight = tmp.z;

