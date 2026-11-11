struct DisplayCamera { forward: vec4f, right: vec4f, up: vec4f, screen: vec4f }
@group(1) @binding(0) var<uniform> displayCamera: DisplayCamera;
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    let positions = array<vec2f, 3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
    return vec4f(positions[index], 0.0, 1.0);
}
@fragment fn fragmentMain(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
    let uv = pixel.xy / displayCamera.screen.xy;
    let direction = normalize(displayCamera.forward.xyz
        + (2.0*uv.x-1.0)*displayCamera.right.w*displayCamera.right.xyz
        + (1.0-2.0*uv.y)*displayCamera.up.w*displayCamera.up.xyz);
    let radiance = max(vec3f(0.0), atmosphere_skyRadiance(direction));
    let mapped = vec3f(1.0) - exp(-radiance*displayCamera.screen.z);
    let encoded = select(1.055*pow(mapped,vec3f(1.0/2.4))-vec3f(0.055),
        12.92*mapped, mapped <= vec3f(0.0031308));
    return vec4f(encoded, 1.0);
}
