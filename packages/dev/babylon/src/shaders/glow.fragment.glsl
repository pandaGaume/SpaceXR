precision highp float;
varying vec2 vUV;
uniform float time;

void main(void) {
    float glow = sin(vUV.x * 20.0 + time) * 0.5 + 0.5;
    vec3 neonColor = vec3(0.0, 0.5, 1.0);

    // Distance au centre pour le fade
    float distToCenter = abs(vUV.y - 0.5);
    float edgeFade = 1.0 - smoothstep(0.0, 0.5, distToCenter);

    gl_FragColor = vec4(neonColor * glow, edgeFade);
}