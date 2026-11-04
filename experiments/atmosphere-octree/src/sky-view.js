import { FrustumCamera } from './frustum.js';
import { dot, inside, intersectEllipsoid, normalize } from './geometry.js';
import { geographicCoordinates } from './solar-lut.js';
const PI = Math.PI;
export function skyBasis(ellipsoid, origin) {
    const { latitude, longitude } = geographicCoordinates(ellipsoid, origin);
    const east = [-Math.sin(longitude), Math.cos(longitude), 0];
    const north = [-Math.sin(latitude) * Math.cos(longitude), -Math.sin(latitude) * Math.sin(longitude), Math.cos(latitude)];
    const up = [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
    return { east, north, up };
}
export function skyDirection(basis, azimuth, elevation) {
    const c = Math.cos(elevation), s = Math.sin(elevation);
    return normalize(basis.up.map((v, i) => v * s + c * (Math.cos(azimuth) * basis.east[i] + Math.sin(azimuth) * basis.north[i])));
}
/** Tangent ray found in double precision for each azimuth, using the actual ellipsoid. */
export function horizonElevation(ellipsoid, origin, basis, azimuth) {
    let low = -PI / 2, high = 0;
    for (let i = 0; i < 48; i++) {
        const middle = (low + high) / 2;
        const hit = intersectEllipsoid(ellipsoid, origin, skyDirection(basis, azimuth, middle));
        if (hit && hit[0] >= 0) low = middle; else high = middle;
    }
    return (low + high) / 2;
}
export function skyElevationFromUnit(t, horizon, ground) {
    const span = ground ? horizon + PI / 2 : PI / 2 - horizon;
    return horizon + (ground ? -1 : 1) * span * t * t;
}
export function skyUnitFromElevation(elevation, horizon, ground) {
    const span = ground ? horizon + PI / 2 : PI / 2 - horizon;
    return Math.sqrt(Math.max(0, Math.min(1, Math.abs(elevation - horizon) / Math.max(span, 1e-12))));
}
export function makeSkyViewLayout(model, origin, { width = 256, hemisphereRows = 64, samples = 64 } = {}) {
    if (![width, hemisphereRows, samples].every(Number.isInteger) || width < 8 || width > 1024 || hemisphereRows < 4 || hemisphereRows > 256 || samples < 8 || samples > 256) throw new Error('Invalid Sky-View quality');
    if (origin.length !== 3 || !origin.every(Number.isFinite) || inside(model.ellipsoid, origin)) throw new Error('Sky camera must be on or above the ellipsoid');
    const basis = skyBasis(model.ellipsoid, origin);
    const horizon = new Float32Array(width);
    for (let x = 0; x < width; x++) horizon[x] = horizonElevation(model.ellipsoid, origin, basis, x / width * 2 * PI);
    return { width, hemisphereRows, height: hemisphereRows * 2, samples, basis, horizon, bytes: width * hemisphereRows * 2 * 8 * 3 };
}
export function skyTextureCoordinates(layout, direction) {
    const d = normalize(direction), basis = layout.basis;
    const azimuth = ((Math.atan2(dot(d, basis.north), dot(d, basis.east)) / (2 * PI)) + 1) % 1;
    const x = azimuth * layout.width, left = Math.floor(x), fraction = x - left;
    const h = layout.horizon[left % layout.width] * (1 - fraction) + layout.horizon[(left + 1) % layout.width] * fraction;
    const elevation = Math.atan2(dot(d, basis.up), Math.hypot(dot(d, basis.east), dot(d, basis.north)));
    const ground = elevation < h;
    const t = skyUnitFromElevation(elevation, h, ground);
    return { u: (x + 0.5) / layout.width, v: ((ground ? layout.hemisphereRows : 0) + t * (layout.hemisphereRows - 1) + 0.5) / layout.height, ground, horizon: h, elevation };
}
/** Preserve vertical field of view with square display pixels. */
export function cameraForDisplay(camera, width, height) {
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 8192)) throw new Error('Invalid display dimensions');
    return new FrustumCamera(camera.origin, camera.forward, camera.right, camera.up, camera.halfHeight * width / height, camera.halfHeight);
}
