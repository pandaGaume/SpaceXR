    if( edgeThickness != 0.0 ) 
    {
        gl_FragColor = mix(edgeColor, gl_FragColor, edgeFactor(vBarys,edgeThickness));
    }