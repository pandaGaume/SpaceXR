
#if defined(HOLOGRAPHIC_BOUNDS_BOX) || defined(HOLOGRAPHIC_BOUNDS_CYLINDER) || defined(HOLOGRAPHIC_BOUNDS_SPHERE)
bvec4 isNegative = lessThan(vfClipDistance, vec4(0.0));
bool anyNegative = any(isNegative);
if (anyNegative) {
  // At least one component of 'vector' is negative
  discard;
}
#endif

