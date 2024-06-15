
#if defined(CLIP_PLANES)
vfClipDistance.x = clipDistance(worldPosition.xyz, uNorthClip);
vfClipDistance.y = clipDistance(worldPosition.xyz, uSouthClip);
vfClipDistance.z = clipDistance(worldPosition.xyz, uEastClip);
vfClipDistance.w = clipDistance(worldPosition.xyz, uWestClip);
#endif

