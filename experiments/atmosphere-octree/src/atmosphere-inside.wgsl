// Entry point for cameras inside the geodetic atmosphere.
// Shared ellipsoidal equations and LUT bindings are injected before this file.
@compute @workgroup_size(64)
fn main_inside(@builtin(global_invocation_id) id: vec3u) {
    renderAtmosphere(id, false);
}
