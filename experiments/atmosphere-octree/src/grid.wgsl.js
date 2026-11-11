/** All grid variants share conservative cell flags and identical lookup coordinates. */
export function gridWgsl(layout) {
    const declarations = `
struct Grid { minimum: vec4f, step: vec4f, dimensions: vec4u }
@group(0) @binding(4) var<uniform> grid: Grid;
@group(0) @binding(5) var<storage, read> gridFlags: array<u32>;
`;
    let input, lookup;
    if (layout === 'buffer') {
        input = '@group(0) @binding(6) var<storage, read> gridValues: array<vec4f>;';
        lookup = `var value = vec3f(0.0);
    for (var k = 0u; k < 8u; k++) {
        let corner = cell + vec3u(k & 1u, (k >> 1u) & 1u, (k >> 2u) & 1u);
        let weights = vec3f(select(1.0 - u.x, u.x, (k & 1u) != 0u), select(1.0 - u.y, u.y, (k & 2u) != 0u), select(1.0 - u.z, u.z, (k & 4u) != 0u));
        value += gridValues[corner.x + n * (corner.y + n * corner.z)].xyz * weights.x * weights.y * weights.z;
    }
    return blendSeams(p, u, value);`;
    } else if (layout === 'texture3d') {
        input = '@group(0) @binding(6) var gridTexture: texture_3d<f32>; @group(0) @binding(7) var gridSampler: sampler;';
        lookup = 'return blendSeams(p, u, textureSampleLevel(gridTexture, gridSampler, (q + 0.5) / f32(n), 0.0).xyz);';
    } else if (layout === 'atlas2d') {
        input = '@group(0) @binding(6) var gridTexture: texture_2d<f32>; @group(0) @binding(7) var gridSampler: sampler;';
        lookup = `let uv0 = vec2f((f32(cell.z * n) + q.x + 0.5) / f32(n * n), (q.y + 0.5) / f32(n));
    let uv1 = uv0 + vec2f(1.0 / f32(n), 0.0);
    return blendSeams(p, u, mix(textureSampleLevel(gridTexture, gridSampler, uv0, 0.0).xyz, textureSampleLevel(gridTexture, gridSampler, uv1, 0.0).xyz, u.z));`;
    } else throw new Error('Unknown grid layout');
    return declarations + input + `
fn gridSolar(p: vec3f) -> vec3f {
    if blocked(p) { return vec3f(0.0); }
    let n = grid.dimensions.x;
    let q = (p - grid.minimum.xyz) / grid.step.xyz;
    if any(q < vec3f(0.0)) || any(q >= vec3f(f32(n - 1u))) { return directSolar(p); }
    let cell = vec3u(floor(q)); let u = fract(q);
    if gridFlags[cell.x + n * (cell.y + n * cell.z)] == 0u { return directSolar(p); }
    cacheHits++;
    ${lookup}
}
`;
}
