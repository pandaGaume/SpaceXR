
#if defined(HOLOGRAPHIC_BOUNDS_BOX)
struct Plane
{
    vec3 point;
    vec3 normal;
};

float clipDistance(vec3 worldPos, Plane plane )
{
    vec3 p = worldPos - plane.point;
    return dot(p,plane.normal);
}

uniform Plane uNorthClip;
uniform Plane uSouthClip;
uniform Plane uEastClip;
uniform Plane uWestClip;

out vec4 vfClipDistance;
#endif

#if defined(HOLOGRAPHIC_BOUNDS_SPHERE)

uniform float uRadiusClip;
out vec4 vfClipDistance;
#endif

#if defined(HOLOGRAPHIC_BOUNDS_CYLINDER)

uniform float uRadiusClip;
uniform vec3 uHeightClip;
out vec4 vfClipDistance;

#endif