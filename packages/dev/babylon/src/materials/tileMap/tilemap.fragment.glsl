precision highp float;

    // Varying
    varying vec4 vPosition;
    varying vec3 vNormal;
	varying float fClipDistance;
 
    // Uniforms
    uniform mat4 world;
    uniform vec3 lightPosition;
    uniform vec3 terrainColor;

    void main(void) {
        
        if (fClipDistance > 0.0)
	    {
		    discard;
	    }

        // World values
        vec3 positionW = vec3(world * vPosition);
        vec3 normalW = normalize(vec3(world * vec4(vNormal, 0.0)));
        
        // Light
        vec3 lightVectorW = normalize(lightPosition - positionW);
       
        // diffuse
        float ndl = max(0., dot(normalW, lightVectorW));
    
        gl_FragColor = vec4(terrainColor * ndl , 1.);  
}