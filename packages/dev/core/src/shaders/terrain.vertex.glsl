    precision highp float;

    const float oneOver2PI = 0.15915494309189533576888;
    const float oneOverPI  = 0.31830988618379067153777;

#ifdef WIREFRAME || WIREFRAME_SQUARE
    #include<barycentric.glsl>
    varying vec2 vBarys;
    varying float vEdgeWeight;
#endif

#include <geodesy.glsl>

#ifdef BABYLON
    #include<instancesDeclaration>
#endif

   // Attributes
    attribute vec3 position;
    attribute vec2 center;
    attribute vec2 size;

    // uniforms
    uniform mat4 viewProjection;
    uniform Ellipsoid ellipsoid;
 
    // Varying
    varying vec2 vUV;
void main(void){

#ifdef BABYLON
    #include<instancesVertex>
#endif

    // compute the location of the instance
    float lat = center.y + position.y * size.y;
    float lon = center.x + position.x * size.x;
    // the altitude is typically retreived from float texture
    float alt = 0.0;

    // get the position from ECEF
    gl_Position = viewProjection * finalWorld * toECEF(ellipsoid,vec3(lon,lat,alt));

    // generate UVs on the fly
    float u = .5  + lon * oneOver2PI ;
    float v = .5  + lat * oneOverPI ;

    vUV = vec2(u, v);

#ifdef WIREFRAME || WIREFRAME_SQUARE
    vBarys = barycentricWeight(gl_VertexID);
    vEdgeWeight = AlternateWeight(gl_VertexID);
#endif
}