const vec2 BARYCENTRIC_VALUES[3] = vec2[](
        vec2(1.0, 0.0), 
        vec2(0.0, 1.0), 
        vec2(0.0, 0.0) 
    );

    const int INDEX_PATTERN [4] = int[](1,2,2,0);

    vec3 barycentricWeight(int vertexId, ivec2 dim){

        float vertexIndex = float(vertexId);
        float w = float(dim.x);

        float line = floor(vertexIndex / w) ; // x is width, y is height
        float col = mod(vertexIndex, w);

        // calculate the index into indices table : 
        // lineoffset * 2.0 is the offset into the table
        // vertexIndex % w is the column
        // column % 2  is an alternate between 0 and 1 to add to the offset
        float lineoffset = mod(line,2.0) ; //  alternat 0 and 1 for even and odd line number
        float offset = lineoffset * 2.0;
        int j =  int( offset +  mod(col,2.0) );
        int i = INDEX_PATTERN[ j ];
        
        // z value is the alternate edge weight begining a 0 or 1 at each row.
        // this enable the partial draw of wireframe.
        return vec3(BARYCENTRIC_VALUES[i], mod(col + lineoffset, 2.0) ) ;
    }
    varying vec2 vBarys;

#if defined(WIREFRAME_SQUARE) && defined(WIREFRAME_EDGE_WEIGHT)
    varying float vEdgeWeight;
#endif