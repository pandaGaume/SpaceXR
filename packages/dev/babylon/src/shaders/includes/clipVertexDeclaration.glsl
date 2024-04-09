
struct Plane {
    vec3 point;
    vec3 normal;
};

float clipDistance(vec4 worldPos, Plane plane ){
    vec3 p = worldPos.xyz - plane.point ;
    return dot(p,plane.normal);
} 

uniform Plane northClip;
uniform Plane southClip;
uniform Plane eastClip;
uniform Plane westClip;
uniform Plane topClip;
uniform Plane bottomClip;

varying vec4 vfClipDistance;


