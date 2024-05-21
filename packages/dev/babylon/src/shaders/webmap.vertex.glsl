// babylon specific
#include<instancesDeclaration>

// this is declaration to clip map along the hologram sides
#include<clipVertexDeclaration>

// this is where to include lights.
#include<lightVertexDeclaration>

// this is the declaration of the function to compute geometry related to elevation data.
#include<elevationVertexDeclaration>

// build in
uniform mat4 world;
uniform mat4 viewProjection; 
in vec3 position; 
in vec2 uv; 
// end build in

uniform vec3 uTerrainColor;

void main(void) {

    // babylon specific
    #include<instancesVertex>

    // we choose the index using the value stored into the z of the position.
    // this value will be [0,3] to index one value into the ids vector. 
    // we assume the value is already clamped.
    float depth = demIds[int(position.z)] ;
    vec3 v = vec3(uv.xy, depth);
    if( depth < 0.0) {
        v.x = v.x == 0.0 ? 1.0 : v.x;
        v.y = v.y == 0.0 ? 1.0 : v.y;   
        v.z = demIds[0];
    } 
  
    // get the position
    float alt0 = float(texture(uAltitudes, v))  ;
    float alt = (alt0 - uAltRange.x) ;
    vec4 p = world * vec4(position.xy, alt ,1.0);
    vec3 worldPos = (world * p).xyz;

    // get the normal
    vec4 pixel = texture(uNormals, v);
    vec4 n = vec4(elevation_rgbaToNormal(pixel),1.0);
    vec3 worldNormal = normalize((world * n).xyz);

    // compute lights
    #if defined(FLAT_SHADING) || defined(GOUREAUD_SHADING)
        #if defined(SPECULAR)
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, worldNormal, worldPos, uViewPosition, uShininess);
        #else
            vec3 lightColor=calculateLight(uAmbientLight, uHemiLight,uPointLights,uNumPointLights,uSpotLights,uNumSpotLights, worldNormal, worldPos);
        #endif
        vColor=vec4(uTerrainColor*lightColor,1.);
    #endif
    #if defined(PHONG_SHADING) || defined (BLINN_PHONG_SHADING)
        vNormal = worldNormal;
        vPosition = worldPos;
    #endif

    // clip map    
    #include<clipVertex>
    
    // finally set the position
    gl_Position = viewProjection * vec4(worldPos,1.0);
    
}