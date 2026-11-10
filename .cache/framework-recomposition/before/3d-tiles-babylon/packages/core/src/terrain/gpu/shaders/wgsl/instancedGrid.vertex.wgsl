/**
 * WGSL twin of ../instancedGrid.vertex.glsl, used by the WebGPU engine; WebGL keeps the GLSL. Both compute the same
 * values in the same order: change them together. See the GLSL file for the attributes and the algorithm.
 *
 * Declarations a path does not read are left out, so that its pipeline only binds the textures the engine sets: the
 * shape texture on the legacy path, the imagery tables with imagery.
 */

attribute position: vec3f;
attribute instPlace: vec4f;
attribute instRotation: vec4f;
#ifdef RUNTIME_SELECTION
attribute instSurface: vec4f;
#endif
#ifdef PROVIDER_NORMALS
attribute instNormal: vec4f;
#ifndef AMBIENT_ONLY
varying vNormalPage: vec4f;
#endif
#endif
attribute instImagery: vec4f;
attribute instElevation: vec4f;
attribute instEdgeN: vec4f;
attribute instEdgeE: vec4f;
attribute instEdgeS: vec4f;
attribute instEdgeW: vec4f;
attribute instCornerNW: vec4f;
attribute instCornerNE: vec4f;
attribute instCornerSE: vec4f;
attribute instCornerSW: vec4f;

uniform viewProjection: mat4x4f;
uniform bodyRotation: mat4x4f;
uniform cells: f32;
uniform verticalScale: f32;
#ifndef RUNTIME_SELECTION
var shapes: texture_2d_array<f32>;
#endif
var elevations: texture_2d_array<f32>;
#ifdef RUNTIME_SELECTION
uniform semiMajorAxis: f32;
uniform eccentricitySquared: f32;
varying vDrape: vec4f;
#else
varying vImagery: vec3f;
#endif

#ifndef AMBIENT_ONLY
#ifdef RUNTIME_SELECTION
varying vTile: vec2f;
varying vPage: vec4f;
varying vUp: vec3f;
varying vEast: vec3f;
varying vSouth: vec3f;
// References of the DEM across each edge of the tile, for the slope of the fragment stage on the edges of a page.
varying vEdgeN: vec4f;
varying vEdgeE: vec4f;
varying vEdgeS: vec4f;
varying vEdgeW: vec4f;
#else
varying vNormal: vec3f;
#endif
#endif

fn steps() -> i32 {
    return i32(2.0 * uniforms.cells + 0.5);
}

// Elevation reference of a lattice point: a corner, an edge, or the interior.
fn elevationAt(h: vec2i) -> vec4f {
    let last = steps();
    let north = h.y == 0;
    let south = h.y == last;
    let west = h.x == 0;
    let east = h.x == last;
    if (north && west) { return vertexInputs.instCornerNW; }
    if (north && east) { return vertexInputs.instCornerNE; }
    if (south && east) { return vertexInputs.instCornerSE; }
    if (south && west) { return vertexInputs.instCornerSW; }
    if (north) { return vertexInputs.instEdgeN; }
    if (east) { return vertexInputs.instEdgeE; }
    if (south) { return vertexInputs.instEdgeS; }
    if (west) { return vertexInputs.instEdgeW; }
    return vertexInputs.instElevation;
}

// Height at tile coordinates in a DEM page, interpolated bilinearly between its heights.
fn heightIn(reference: vec4f, uv: vec2f) -> f32 {
    if (reference.w < 0.0) { return 0.0; }
    let size = f32(i32(textureDimensions(elevations, 0).x) - 2);
    let texel = (reference.xy + uv * reference.z) * (size - 1.0);
    let cell = clamp(vec2i(floor(texel)), vec2i(0), vec2i(i32(size) - 2));
    let f = clamp(texel - vec2f(cell), vec2f(0.0), vec2f(1.0));
    let layer = i32(reference.w + 0.5);
    // One-sample gutter surrounds the point DEM.
    let base = cell + vec2i(1);
    let h00 = textureLoad(elevations, base, layer, 0).r;
    let h10 = textureLoad(elevations, base + vec2i(1, 0), layer, 0).r;
    let h01 = textureLoad(elevations, base + vec2i(0, 1), layer, 0).r;
    let h11 = textureLoad(elevations, base + vec2i(1, 1), layer, 0).r;
    return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y) * uniforms.verticalScale;
}

#ifdef RUNTIME_SELECTION
// Stable local trigonometry: see the GLSL shader.
fn mercatorSinCos(angle: f32) -> vec2f {
    var reduced = angle;
    var cosineSign = 1.0;
    if (angle > 1.5707963267948966) { reduced = 3.141592653589793 - angle; cosineSign = -1.0; }
    if (angle < -1.5707963267948966) { reduced = -3.141592653589793 - angle; cosineSign = -1.0; }
    let t = reduced * reduced;
    let sine = reduced * (1.0 + t * (-1.0 / 6.0 + t * (1.0 / 120.0 + t * (-1.0 / 5040.0
        + t * (1.0 / 362880.0 + t * (-1.0 / 39916800.0 + t / 6227020800.0))))));
    let cosine = 1.0 + t * (-0.5 + t * (1.0 / 24.0 + t * (-1.0 / 720.0
        + t * (1.0 / 40320.0 + t * (-1.0 / 3628800.0 + t / 479001600.0)))));
    return vec2f(sine, cosine * cosineSign);
}

// Differences around the centre of the tile, never a subtraction of two planet-sized positions: see the GLSL shader.
// surfaceInfo receives sine latitude, cosine latitude, N and its denominator.
fn mercatorSurface(uv: vec2f, surfaceInfo: ptr<function, vec4f>) -> vec3f {
    let surface = vertexInputs.instSurface;
    let dq = (0.5 - uv.y) * vertexInputs.instRotation.z;
    let halfDq = 0.5 * dq;
    let t = halfDq * halfDq;
    let sh = halfDq * (1.0 + t * (1.0 / 6.0 + t * (1.0 / 120.0 + t * (1.0 / 5040.0
        + t * (1.0 / 362880.0 + t * (1.0 / 39916800.0 + t / 6227020800.0))))));
    let ch = 1.0 + t * (0.5 + t * (1.0 / 24.0 + t * (1.0 / 720.0
        + t * (1.0 / 40320.0 + t * (1.0 / 3628800.0 + t * (1.0 / 479001600.0 + t / 87178291200.0))))));
    let numerator = 2.0 * surface.z * sh * (ch + surface.y * sh);
    let denominatorAngle = 1.0 + 2.0 * surface.y * sh * (surface.y * sh + ch);
    let norm = length(vec2f(numerator, denominatorAngle));
    let sineAngle = numerator / norm;
    let cosineAngleMinusOne = -numerator * numerator / (norm * (norm + denominatorAngle));
    let sineDelta = surface.y * cosineAngleMinusOne + surface.z * sineAngle;
    let cosineDelta = surface.z * cosineAngleMinusOne - surface.y * sineAngle;
    let sine = surface.y + sineDelta;
    let cosine = surface.z + cosineDelta;
    let denominator = sqrt(1.0 - uniforms.eccentricitySquared * sine * sine);
    let centreDenominator = sqrt(1.0 - uniforms.eccentricitySquared * surface.y * surface.y);
    let radiusDelta = uniforms.semiMajorAxis * uniforms.eccentricitySquared * sineDelta * (sine + surface.y)
        / (denominator * centreDenominator * (denominator + centreDenominator));
    let radius = surface.w + radiusDelta;
    let longitude = (uv.x - 0.5) * vertexInputs.instRotation.z;
    let sineHalfLongitude = mercatorSinCos(0.5 * longitude).x;
    let x = radiusDelta * cosine + surface.w * cosineDelta - 2.0 * radius * cosine * sineHalfLongitude * sineHalfLongitude;
    let y = radius * cosine * mercatorSinCos(longitude).x;
    let z = (1.0 - uniforms.eccentricitySquared) * (radiusDelta * sine + surface.w * sineDelta);
    *surfaceInfo = vec4f(sine, cosine, radius, denominator);
    return vec3f(x, y, z);
}
#endif

#ifndef RUNTIME_SELECTION
// Displaced position of a lattice point, in the frame of the shape, where the tile centre longitude is 0.
fn sampledPosition(h: vec2i) -> vec3f {
    let uv = vec2f(h) / f32(steps());
    let shape = textureLoad(shapes, h, i32(vertexInputs.instPlace.w + 0.5), 0);
    let longitude = (uv.x - 0.5) * vertexInputs.instRotation.z;
    let up = vec3f(cos(shape.w) * cos(longitude), cos(shape.w) * sin(longitude), sin(shape.w));
    return shape.xyz + up * heightIn(elevationAt(h), uv);
}

fn finerAcross(bit: i32) -> bool {
    return (i32(vertexInputs.instRotation.w + 0.5) & bit) != 0;
}

// Position of a lattice point. An edge midpoint lies on the segment between its two neighbours on the edge, the
// segment drawn by a coarser or same-level instance across, unless the instances across are finer: it is then one
// of their vertices and reads its height like them.
fn positionAt(lattice: vec2i) -> vec3f {
    let last = steps();
    let h = clamp(lattice, vec2i(0), vec2i(last));
    let alongNorthSouth = (h.y == 0 && !finerAcross(1)) || (h.y == last && !finerAcross(4));
    let alongEastWest = (h.x == last && !finerAcross(2)) || (h.x == 0 && !finerAcross(8));
    if (alongNorthSouth && (h.x & 1) == 1) {
        return 0.5 * (sampledPosition(h - vec2i(1, 0)) + sampledPosition(h + vec2i(1, 0)));
    }
    if (alongEastWest && (h.y & 1) == 1) {
        return 0.5 * (sampledPosition(h - vec2i(0, 1)) + sampledPosition(h + vec2i(0, 1)));
    }
    return sampledPosition(h);
}
#endif

// Rotation about the polar axis by the longitude of the tile centre.
fn rotate(p: vec3f) -> vec3f {
    let rotation = vertexInputs.instRotation;
    return vec3f(rotation.x * p.x - rotation.y * p.y, rotation.y * p.x + rotation.x * p.y, p.z);
}

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    let uv = vertexInputs.position.xy;
    let h = vec2i(floor(uv * f32(steps()) + 0.5));
#ifdef RUNTIME_SELECTION
    var surfaceInfo: vec4f;
    let surface = mercatorSurface(uv, &surfaceInfo);
    let longitude = (uv.x - 0.5) * vertexInputs.instRotation.z;
    let longitudeSinCos = mercatorSinCos(longitude);
    let localUp = vec3f(surfaceInfo.y * longitudeSinCos.y, surfaceInfo.y * longitudeSinCos.x, surfaceInfo.x);
    let local = surface + localUp * heightIn(elevationAt(h), uv);
#else
    let local = positionAt(h);
#endif

#ifndef AMBIENT_ONLY
#ifdef PROVIDER_NORMALS
    vertexOutputs.vNormalPage = vertexInputs.instNormal;
#endif
#ifdef RUNTIME_SELECTION
    let sine = surfaceInfo.x;
    let cosine = surfaceInfo.y;
    let denominator = surfaceInfo.w;
    let normalRadius = surfaceInfo.z;
    let meridianRadius = uniforms.semiMajorAxis * (1.0 - uniforms.eccentricitySquared) / (denominator * denominator * denominator);
    vertexOutputs.vUp = rotate(localUp);
    vertexOutputs.vEast = rotate(vec3f(-longitudeSinCos.x, longitudeSinCos.y, 0.0)) * (normalRadius * cosine * vertexInputs.instRotation.z);
    let north = vec3f(-sine * longitudeSinCos.y, -sine * longitudeSinCos.x, cosine);
    vertexOutputs.vSouth = rotate(-north) * (meridianRadius * cosine * vertexInputs.instRotation.z);
    vertexOutputs.vTile = uv;
    vertexOutputs.vPage = vertexInputs.instElevation;
    vertexOutputs.vEdgeN = vertexInputs.instEdgeN;
    vertexOutputs.vEdgeE = vertexInputs.instEdgeE;
    vertexOutputs.vEdgeS = vertexInputs.instEdgeS;
    vertexOutputs.vEdgeW = vertexInputs.instEdgeW;
#else
    // Normal of the displaced surface, from the neighbours one cell away, clamped to the tile: east cross north.
    let eastward = positionAt(h + vec2i(2, 0)) - positionAt(h - vec2i(2, 0));
    let northward = positionAt(h - vec2i(0, 2)) - positionAt(h + vec2i(0, 2));
    vertexOutputs.vNormal = rotate(normalize(cross(eastward, northward)));
#endif
#endif
#ifdef RUNTIME_SELECTION
    vertexOutputs.vDrape = vec4f(uv, vertexInputs.instImagery.xy);
#else
    vertexOutputs.vImagery = vec3f(vertexInputs.instImagery.xy + uv * vertexInputs.instImagery.z, vertexInputs.instImagery.w);
#endif
    vertexOutputs.position = uniforms.viewProjection * uniforms.bodyRotation * vec4f(rotate(local) + vertexInputs.instPlace.xyz, 1.0);
}
