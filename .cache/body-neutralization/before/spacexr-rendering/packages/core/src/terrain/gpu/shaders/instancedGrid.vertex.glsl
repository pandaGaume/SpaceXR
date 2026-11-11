/**
 * Runtime-selected Web Mercator draws the topology of its fine-side junctions; the legacy cube path draws a grid
 * refined on its edges. Per-instance attributes place either topology:
 *
 * - instPlace: tile centre minus camera position, computed in double precision; w is a legacy shape layer.
 * - instRotation: cosine and sine of centre longitude, longitude span and legacy finer-edge bits; radial heights
 *   instead store the tile centre on the body and the finer-edge bits.
 * - instSurface: compact reference-ellipsoid parameters for analytic Mercator, centre ordinate, sin/cos latitude, N.
 * - instImagery: drape table depth/layer for runtime Mercator, or area and imagery layer for the legacy cut.
 * - instElevation and instEdge/Corner: area and page layer of the DEM serving that part of the tile. The fractional
 *   part of the layer stores quarter turns across cube faces.
 *
 * Position holds normalized u/v. Runtime junction indices remove surplus fine-edge vertices; that path never snaps
 * vertices and never reads a texture of XYZ positions. The legacy path still uses its half-cell edge midpoints.
 */

precision highp float;
precision highp int;
precision highp sampler2DArray;

attribute vec3 position;
attribute vec4 instPlace;
attribute vec4 instRotation;
attribute vec4 instSurface;
#ifdef PROVIDER_NORMALS
attribute vec4 instNormal;
#ifndef AMBIENT_ONLY
varying vec4 vNormalPage;
#endif
#endif
attribute vec4 instImagery;
attribute vec4 instElevation;
attribute vec4 instEdgeN;
attribute vec4 instEdgeE;
attribute vec4 instEdgeS;
attribute vec4 instEdgeW;
attribute vec4 instCornerNW;
attribute vec4 instCornerNE;
attribute vec4 instCornerSE;
attribute vec4 instCornerSW;

uniform mat4 viewProjection;
uniform mat4 bodyRotation;
uniform float cells;
uniform float verticalScale;
uniform sampler2DArray shapes;
uniform sampler2DArray elevations;
#ifdef RUNTIME_SELECTION
uniform float semiMajorAxis;
uniform float eccentricitySquared;
varying vec4 vDrape;
#endif

varying vec3 vImagery;
#ifndef AMBIENT_ONLY
#ifdef RUNTIME_SELECTION
// Inverse squared radii of the reference surface.
uniform vec3 inverseRadiiSquared;
varying vec2 vTile;
varying vec4 vPage;
varying vec3 vUp;
varying vec3 vEast;
varying vec3 vSouth;
// References of the DEM across each edge of the tile, for the slope of the fragment stage on the edges of a page.
varying vec4 vEdgeN;
varying vec4 vEdgeE;
varying vec4 vEdgeS;
varying vec4 vEdgeW;
#else
varying vec3 vNormal;
#endif
#endif

int steps() {
    return int(2.0 * cells + 0.5);
}

// Elevation reference of a lattice point: a corner, an edge, or the interior.
vec4 elevationAt(ivec2 h) {
    int last = steps();
    bool north = h.y == 0;
    bool south = h.y == last;
    bool west = h.x == 0;
    bool east = h.x == last;
    if (north && west) return instCornerNW;
    if (north && east) return instCornerNE;
    if (south && east) return instCornerSE;
    if (south && west) return instCornerSW;
    if (north) return instEdgeN;
    if (east) return instEdgeE;
    if (south) return instEdgeS;
    if (west) return instEdgeW;
    return instElevation;
}

// Height at tile coordinates in a DEM page, interpolated bilinearly between its heights.
float heightIn(vec4 reference, vec2 uv) {
    if (reference.w < 0.0) return 0.0;
    float size = float(textureSize(elevations, 0).x - 2);
    vec2 texel = (reference.xy + uv * reference.z) * (size - 1.0);
    ivec2 base = clamp(ivec2(floor(texel)), ivec2(0), ivec2(int(size) - 2));
    vec2 f = clamp(texel - vec2(base), 0.0, 1.0);
    int layer = int(reference.w + 0.5);
    base += ivec2(1); // One-sample gutter surrounds the point DEM.
    float h00 = texelFetch(elevations, ivec3(base, layer), 0).r;
    float h10 = texelFetch(elevations, ivec3(base + ivec2(1, 0), layer), 0).r;
    float h01 = texelFetch(elevations, ivec3(base + ivec2(0, 1), layer), 0).r;
    float h11 = texelFetch(elevations, ivec3(base + ivec2(1, 1), layer), 0).r;
    return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y) * verticalScale;
}

#ifdef RUNTIME_SELECTION
// Stable local trigonometry. Some drivers give small built-in sin/sinh arguments an absolute error independent of
// their magnitude, which becomes metre-sized after multiplication by the reference radius. The local Mercator
// angles are bounded by pi; reduction keeps these polynomials inside [-pi/2, pi/2].
vec2 mercatorSinCos(float angle) {
    float reduced = angle;
    float cosineSign = 1.0;
    if (angle > 1.5707963267948966) { reduced = 3.141592653589793 - angle; cosineSign = -1.0; }
    if (angle < -1.5707963267948966) { reduced = -3.141592653589793 - angle; cosineSign = -1.0; }
    float t = reduced * reduced;
    float sine = reduced * (1.0 + t * (-1.0 / 6.0 + t * (1.0 / 120.0 + t * (-1.0 / 5040.0
        + t * (1.0 / 362880.0 + t * (-1.0 / 39916800.0 + t / 6227020800.0))))));
    float cosine = 1.0 + t * (-0.5 + t * (1.0 / 24.0 + t * (-1.0 / 720.0
        + t * (1.0 / 40320.0 + t * (-1.0 / 3628800.0 + t / 479001600.0)))));
    return vec2(sine, cosine * cosineSign);
}

// Differences around the centre of the tile, never a subtraction of two planet-sized positions. The sine and
// cosine of the latitude difference follow the tangent subtraction identity for atan(sinh(q)), avoiding angles
// and repeated hyperbolic evaluation. surfaceInfo holds sine latitude, cosine latitude, N and its denominator.
vec3 mercatorSurface(vec2 uv, out vec4 surfaceInfo) {
    float dq = (0.5 - uv.y) * instRotation.z;
    float halfDq = 0.5 * dq;
    float t = halfDq * halfDq;
    // |halfDq| <= pi/2 even for a whole-world tile; on the current minLOD 3 it is <= pi/16.
    float sh = halfDq * (1.0 + t * (1.0 / 6.0 + t * (1.0 / 120.0 + t * (1.0 / 5040.0
        + t * (1.0 / 362880.0 + t * (1.0 / 39916800.0 + t / 6227020800.0))))));
    float ch = 1.0 + t * (0.5 + t * (1.0 / 24.0 + t * (1.0 / 720.0
        + t * (1.0 / 40320.0 + t * (1.0 / 3628800.0 + t * (1.0 / 479001600.0 + t / 87178291200.0))))));
    float numerator = 2.0 * instSurface.z * sh * (ch + instSurface.y * sh);
    float denominatorAngle = 1.0 + 2.0 * instSurface.y * sh * (instSurface.y * sh + ch);
    float norm = length(vec2(numerator, denominatorAngle));
    float sineAngle = numerator / norm;
    float cosineAngleMinusOne = -numerator * numerator / (norm * (norm + denominatorAngle));
    float sineDelta = instSurface.y * cosineAngleMinusOne + instSurface.z * sineAngle;
    float cosineDelta = instSurface.z * cosineAngleMinusOne - instSurface.y * sineAngle;
    float sine = instSurface.y + sineDelta;
    float cosine = instSurface.z + cosineDelta;
    float denominator = sqrt(1.0 - eccentricitySquared * sine * sine);
    float centreDenominator = sqrt(1.0 - eccentricitySquared * instSurface.y * instSurface.y);
    float radiusDelta = semiMajorAxis * eccentricitySquared * sineDelta * (sine + instSurface.y)
        / (denominator * centreDenominator * (denominator + centreDenominator));
    float radius = instSurface.w + radiusDelta;
    float longitude = (uv.x - 0.5) * instRotation.z;
    float sineHalfLongitude = mercatorSinCos(0.5 * longitude).x;
    float x = radiusDelta * cosine + instSurface.w * cosineDelta - 2.0 * radius * cosine * sineHalfLongitude * sineHalfLongitude;
    float y = radius * cosine * mercatorSinCos(longitude).x;
    float z = (1.0 - eccentricitySquared) * (radiusDelta * sine + instSurface.w * sineDelta);
    surfaceInfo = vec4(sine, cosine, radius, denominator);
    return vec3(x, y, z);
}
#endif

// Displaced position of a lattice point, in the frame of the shape, where the tile centre longitude is 0.
vec3 sampledPosition(ivec2 h) {
    vec2 uv = vec2(h) / float(steps());
#ifdef RUNTIME_SELECTION
    vec4 surfaceInfo;
    vec3 offset = mercatorSurface(uv, surfaceInfo);
    vec4 shape = vec4(offset, atan(surfaceInfo.x, surfaceInfo.y));
#else
    vec4 shape = texelFetch(shapes, ivec3(h, int(instPlace.w + 0.5)), 0);
#endif
    float longitude = (uv.x - 0.5) * instRotation.z;
    vec3 up = vec3(cos(shape.w) * cos(longitude), cos(shape.w) * sin(longitude), sin(shape.w));
    return shape.xyz + up * heightIn(elevationAt(h), uv);
}

bool finerAcross(int bit) {
    return (int(instRotation.w + 0.5) & bit) != 0;
}

// Position of a lattice point. An edge midpoint lies on the segment between its two neighbours on the edge, the
// segment drawn by a coarser or same-level instance across, unless the instances across are finer: it is then one
// of their vertices and reads its height like them.
vec3 positionAt(ivec2 h) {
    int last = steps();
    h = clamp(h, ivec2(0), ivec2(last));
#ifdef RUNTIME_SELECTION
    // Fine-side Coarser index topologies remove the extra edge vertices. No vertex is snapped by this shader.
    return sampledPosition(h);
#else
    bool alongNorthSouth = (h.y == 0 && !finerAcross(1)) || (h.y == last && !finerAcross(4));
    bool alongEastWest = (h.x == last && !finerAcross(2)) || (h.x == 0 && !finerAcross(8));
    if (alongNorthSouth && (h.x & 1) == 1) return 0.5 * (sampledPosition(h - ivec2(1, 0)) + sampledPosition(h + ivec2(1, 0)));
    if (alongEastWest && (h.y & 1) == 1) return 0.5 * (sampledPosition(h - ivec2(0, 1)) + sampledPosition(h + ivec2(0, 1)));
    return sampledPosition(h);
#endif
}

#ifndef AMBIENT_ONLY
#endif

// Rotation about the polar axis by the longitude of the tile centre.
vec3 rotate(vec3 p) {
    return vec3(instRotation.x * p.x - instRotation.y * p.y, instRotation.y * p.x + instRotation.x * p.y, p.z);
}

void main(void) {
    ivec2 h = ivec2(floor(position.xy * float(steps()) + 0.5));
#ifdef RUNTIME_SELECTION
    vec4 surfaceInfo;
    vec3 surface = mercatorSurface(position.xy, surfaceInfo);
    float longitude = (position.x - 0.5) * instRotation.z;
    vec2 longitudeSinCos = mercatorSinCos(longitude);
    vec3 localUp = vec3(surfaceInfo.y * longitudeSinCos.y, surfaceInfo.y * longitudeSinCos.x, surfaceInfo.x);
    vec3 local = surface + localUp * heightIn(elevationAt(h), position.xy);
#else
    vec3 local = positionAt(h);
#endif

#ifndef AMBIENT_ONLY
#ifdef PROVIDER_NORMALS
    vNormalPage = instNormal;
#endif
#ifdef RUNTIME_SELECTION
    vec2 uv = position.xy;
    float sine = surfaceInfo.x, cosine = surfaceInfo.y;
    float denominator = surfaceInfo.w;
    float normalRadius = surfaceInfo.z;
    float meridianRadius = semiMajorAxis * (1.0 - eccentricitySquared) / (denominator * denominator * denominator);
    vUp = rotate(localUp);
    vEast = rotate(vec3(-longitudeSinCos.x, longitudeSinCos.y, 0.0)) * (normalRadius * cosine * instRotation.z);
    vec3 north = vec3(-sine * longitudeSinCos.y, -sine * longitudeSinCos.x, cosine);
    vSouth = rotate(-north) * (meridianRadius * cosine * instRotation.z);
    vTile = uv;
    vPage = instElevation;
    vEdgeN = instEdgeN;
    vEdgeE = instEdgeE;
    vEdgeS = instEdgeS;
    vEdgeW = instEdgeW;
#else
    // Normal of the displaced surface, from the neighbours one cell away, clamped to the tile: east cross north.
    vec3 eastward = positionAt(h + ivec2(2, 0)) - positionAt(h - ivec2(2, 0));
    vec3 northward = positionAt(h - ivec2(0, 2)) - positionAt(h + ivec2(0, 2));
    vec3 normal = normalize(cross(eastward, northward));
    vNormal = rotate(normal);
#endif
#endif
#ifdef RUNTIME_SELECTION
    vDrape = vec4(position.xy, instImagery.xy);
#else
    vImagery = vec3(instImagery.xy + position.xy * instImagery.z, instImagery.w);
#endif
    gl_Position = viewProjection * bodyRotation * vec4(rotate(local) + instPlace.xyz, 1.0);
}
