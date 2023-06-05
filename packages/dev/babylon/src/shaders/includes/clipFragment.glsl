
bvec4 isNegative = lessThan(vfClipDistance, vec4(0.0));
bool anyNegative = any(isNegative);
if (anyNegative) {
  // At least one component of 'vector' is negative
  discard;
}

