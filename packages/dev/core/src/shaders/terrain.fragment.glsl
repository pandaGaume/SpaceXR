precision highp float;

#ifdef WIREFRAME || WIREFRAME_SQUARE
    #include<barycentric.glsl>
    uniform float edgeThickness;
    uniform vec4 edgeColor ;
    uniform vec2 edgeVisibilityRange ;
    varying vec2 vBarys;
    varying float vEdgeWeight;
#endif

    uniform sampler2D textureSampler;

    varying vec2 vUV;

void main(void) {
    gl_FragColor = texture2D(textureSampler, vUV);
    #ifdef WIREFRAME || WIREFRAME_SQUARE
        if( edgeThickness != 0.0 && (vEdgeWeight > edgeVisibilityRange.y || vEdgeWeight < edgeVisibilityRange.x)){
            gl_FragColor = mix(edgeColor, gl_FragColor, edgeFactor(vBarys,edgeThickness));
        }
    #endif
}`;