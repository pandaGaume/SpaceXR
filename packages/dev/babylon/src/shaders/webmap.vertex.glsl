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

    // we choose the index using the value stored into the y of the position.
    // this value will be [0,3] to index one value into the ids vector. 
    // we assume the value is already clamped.
    float depth = demIds[int(position.z)] ;
    vec3 v = vec3(uv.xy, depth);
    if( depth < 0.0) {
        // we are in the case of a border vertex, which is defined at 0 by the current REPEAT wrap mode
        // we may have done similar result using wrap mode CLAMP_TO_EDGE.
        v.x = v.x == 0.0 ? 1.0 : v.x;
        v.y = v.y == 0.0 ? 1.0 : v.y;  
        v.z = demIds[0];
    } 

    // get the position
    float alt0 = float(texture(uAltitudes, v)) ;
    float alt = (alt0 -uAltRange.x) * uMapScale;
    vec4 pos = vec4(position.xy, alt, 1.0);
    vec4 worldPosition = finalWorld * pos;

    // get the normal
    vec4 pixel = texture(uNormals, v);
    vec3 rawNormal = elevation_rgbaToNormal(pixel);
    vec3 worldNormal = vec3(-rawNormal.x,rawNormal.z,rawNormal.y); 

    // compute lights
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        #if defined(SPECULAR)
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, worldNormal, worldPosition.xyz, uViewPosition, uShininess);
        #else
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, worldNormal, worldPosition.xyz);
        #endif
        vColor= vec4(uTerrainColor.rgb * lightColor, uTerrainColor.a);
    #endif
    #if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
        vNormal = worldNormal;
        vPosition = worldPosition.xyz;
    #endif

    // clip map    
    #include<clipVertex>
    
    // finally set the position
    gl_Position = viewProjection * worldPosition;
    vUvs = vec3(uv, depth);
}