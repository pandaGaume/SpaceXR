    float f = edgeFactor(vBarys,edgeThickness);
    if( f > 0.0) discard;
    gl_FragColor = mix(edgeColor, backColor, edgeFactor(vBarys,edgeThickness));