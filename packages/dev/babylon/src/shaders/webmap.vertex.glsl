// babylon specific
#include<instancesDeclaration>

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// this is where to include lights.
#include<lightVertexDeclaration>

// this is the declaration of the function to compute geometry related to elevation data.
#include<elevationVertexDeclaration>

// build in
uniform mat4 viewProjection; 
in vec3 position; 
in vec2 uv; 
// end build in

#if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
uniform vec4 uTerrainColor;
#endif
out vec3 vUvs;

void main(void) {

    // babylon specific
    #include<instancesVertex>

    // we choose the index using the value stored into the z of the position.
    // this value will be [0,3] to index one value into the ids vector. 
    // we assume the value is already clamped.
    float depth = demIds[int(position.z)] ;
    if( depth < 0.0) {
        depth = demIds[0];
    } 
    vec3 v = vec3(uv.xy, depth);
  
    // get the position
    float alt0 = float(texture(uAltitudes, v)) ;
    float alt = (alt0 -uAltRange.x) * uMapScale;
    vec4 pos = vec4(position.xy, alt ,1.0);
    vec4 worldPosition = finalWorld * pos;

    // get the normal
    vec4 pixel = texture(uNormals, v);
    vec4 n = vec4(elevation_rgbaToNormal(pixel),1.0);
    vec4 worldNormal = n; //normalize(finalWorld * n);

    // compute lights
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        #if defined(SPECULAR)
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, worldNormal.xyz, worldPosition.xyz, uViewPosition, uShininess);
        #else
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, worldNormal.xyz, worldPosition.xyz);
        #endif
        vColor= vec4(uTerrainColor.rgb * lightColor, uTerrainColor.a);
    #endif
    #if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
        vNormal = worldNormal.xyz;
        vPosition = worldPosition.xyz;
    #endif

    // clip map    
    #include<clipVertex>
    
    // finally set the position
    gl_Position = viewProjection * worldPosition;
    vUvs = vec3(uv, depth);
}