// Entry point for cameras outside the geodetic atmosphere.
// Rays begin at the first positive intersection with the conservative atmosphere envelope.
@compute @workgroup_size(64)
fn main_space(@builtin(global_invocation_id) id: vec3u) {
    renderAtmosphere(id, true);
}
