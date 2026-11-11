/** ECEF coordinates and physical distances use meters. Z is the polar axis. */
export const WGS84 = Object.freeze({ semiMajorAxis: 6378137, semiMinorAxis: 6356752.314245179 });
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const mul = (a, s) => a.map(x => x * s);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = a => Math.hypot(...a);
export function normalize(a) {
    const n = norm(a);
    if (!(n > 0) || !Number.isFinite(n)) throw new Error('Invalid direction');
    return mul(a, 1 / n);
}
export const along = (o, d, t) => add(o, mul(d, t));
export function validateEllipsoid(e) {
    if (!(e.semiMajorAxis >= e.semiMinorAxis && e.semiMinorAxis > 0) || !Number.isFinite(e.semiMajorAxis)) {
        throw new Error('Expected finite oblate ellipsoid axes in meters');
    }
}
export function geodeticPosition(e, latitude, longitude, height) {
    const a = e.semiMajorAxis, b = e.semiMinorAxis;
    const s = Math.sin(latitude), c = Math.cos(latitude), e2 = 1 - (b / a) ** 2;
    const n = a / Math.sqrt(1 - e2 * s * s);
    return [(n + height) * c * Math.cos(longitude), (n + height) * c * Math.sin(longitude), (n * (1 - e2) + height) * s];
}
export function inside(e, p) {
    return (p[0] / e.semiMajorAxis) ** 2 + (p[1] / e.semiMajorAxis) ** 2 + (p[2] / e.semiMinorAxis) ** 2 < 1;
}
/** Exterior geodetic altitude via closest-point projection. No radial-radius approximation.
 * Interior is only classified, never used to integrate atmospheric density.
 */
export function altitude(e, p) {
    if (inside(e, p)) return -1;
    const a = e.semiMajorAxis, b = e.semiMinorAxis;
    const radial = Math.hypot(p[0], p[1]);
    if (radial < 1e-8) return Math.abs(p[2]) - b;
    const e2 = 1 - (b / a) ** 2;
    let lat = Math.atan2(p[2], radial * (1 - e2));
    for (let i = 0; i < 20; i++) {
        const s = Math.sin(lat), n = a / Math.sqrt(1 - e2 * s * s);
        const next = Math.atan2(p[2] + e2 * n * s, radial);
        if (Math.abs(next - lat) < 1e-14) { lat = next; break; }
        lat = next;
    }
    const s = Math.sin(lat), c = Math.cos(lat);
    return Math.max(0, radial * c + p[2] * s - a * Math.sqrt(1 - e2 * s * s));
}
/** Stable quadratic. Direction is not rescaled, so returned t retains physical units. */
export function intersectEllipsoid(e, o, d, scale = 1) {
    const axes = [e.semiMajorAxis * scale, e.semiMajorAxis * scale, e.semiMinorAxis * scale];
    const q = o.map((v, i) => v / axes[i]), v = d.map((x, i) => x / axes[i]);
    const A = dot(v, v), B = 2 * dot(q, v), C = dot(q, q) - 1;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(disc), t = -0.5 * (B + (B < 0 ? -root : root));
    if (t === 0) return [-B / (2 * A), -B / (2 * A)];
    const x = t / A, y = C / t;
    return [Math.min(x, y), Math.max(x, y)];
}
/** Homothetic envelope contains the geodetic offset surface, but does not define density. */
export const envelopeScale = (e, height) => 1 + height / e.semiMinorAxis;
export function atmosphericInterval(model, o, direction, maxDistance = Infinity) {
    const d = normalize(direction), e = model.ellipsoid;
    if (inside(e, o)) return null;
    const outer = intersectEllipsoid(e, o, d, envelopeScale(e, model.top));
    if (!outer) return null;
    const start = Math.max(0, outer[0]);
    let end = Math.min(maxDistance, outer[1]);
    const ground = intersectEllipsoid(e, o, d);
    if (ground && ground[1] >= start) {
        if (ground[0] >= start) end = Math.min(end, ground[0]);
        else if (ground[0] >= -1e-6 && dot(o.map((x, i) => x / (i === 2 ? e.semiMinorAxis ** 2 : e.semiMajorAxis ** 2)), d) < 0) end = start;
    }
    return end > start ? { start, end, direction: d } : null;
}
