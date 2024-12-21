
#if defined(HOLOGRAPHIC_BOUNDS_BOX)
vfClipDistance.x = clipDistance(worldPosition.xyz, uNorthClip);
vfClipDistance.y = clipDistance(worldPosition.xyz, uSouthClip);
vfClipDistance.z = clipDistance(worldPosition.xyz, uEastClip);
vfClipDistance.w = clipDistance(worldPosition.xyz, uWestClip);
#endif

#if defined(HOLOGRAPHIC_BOUNDS_SPHERE)
vfClipDistance = vec4( uRadiusClip - length(worldPosition.xyz));
#endif

#if defined(HOLOGRAPHIC_BOUNDS_CYLINDER)
vfClipDistance = vec4( 0.0f);
#endif
