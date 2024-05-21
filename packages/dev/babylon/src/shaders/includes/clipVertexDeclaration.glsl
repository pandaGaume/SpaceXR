
struct Plane {
    vec3 point;
    vec3 normal;
};

float clipDistance(vec4 worldPos, Plane plane ){
    vec3 p = worldPos.xyz - plane.point ;
    return dot(p,plane.normal);
} 

uniform Plane uNorthClip;
uniform Plane uSouthClip;
uniform Plane uEastClip;
uniform Plane uWestClip;
uniform Plane uTopClip;
uniform Plane uBottomClip;

out vec4 vfClipDistance;


