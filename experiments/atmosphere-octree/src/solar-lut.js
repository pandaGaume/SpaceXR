import { altitude, along, envelopeScale, geodeticPosition, inside, intersectEllipsoid } from './geometry.js';
const PI = Math.PI;
export const wrapLongitude = angle => ((angle + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
/** Reflection in the plane containing the polar axis and Sun makes +/- relative longitude equivalent.
 * Concentrate longitude samples around the local zero-elevation solar direction.
 */
export function terminatorLongitude(latitude, sunZ) {
    const denominator = Math.max(1e-12, Math.cos(latitude) * Math.sqrt(Math.max(0, 1 - sunZ * sunZ)));
    const limit = Math.cos(0.1);
    return Math.acos(Math.max(-limit, Math.min(limit, -Math.sin(latitude) * sunZ / denominator)));
}
export function longitudeFromUnit(u, latitude, sunZ) {
    const center = terminatorLongitude(latitude, sunZ), x = 2 * u - 1;
    return x < 0 ? center * (1 - x * x) : center + (PI - center) * x * x;
}
export function longitudeToUnit(longitude, latitude, sunZ) {
    const center = terminatorLongitude(latitude, sunZ), angle = Math.abs(wrapLongitude(longitude));
    return angle < center ? 0.5 * (1 - Math.sqrt((center - angle) / center)) : 0.5 + 0.5 * Math.sqrt((angle - center) / (PI - center));
}
export function solarSignature(model) {
    return JSON.stringify([model.ellipsoid.semiMajorAxis, model.ellipsoid.semiMinorAxis, model.top, model.rayleighHeight, model.mieHeight, model.sun[2]]);
}
export function solarBlocked(model, p) {
    if (inside(model.ellipsoid, p)) return true;
    const hit = intersectEllipsoid(model.ellipsoid, p, model.sun);
    return !!(hit && hit[1] > 1e-4 && hit[0] >= -1e-4);
}
/** Conservative proximity test for descending solar rays. */
export function solarGrazesGround(model, p, guardHeight) {
    if (!(guardHeight > 0)) return false;
    const e = model.ellipsoid, axes = [e.semiMajorAxis, e.semiMajorAxis, e.semiMinorAxis];
    const q = p.map((v, i) => v / axes[i]), d = model.sun.map((v, i) => v / axes[i]);
    const projection = q.reduce((sum, v, i) => sum + v * d[i], 0);
    if (projection >= 0) return false;
    const length2 = d.reduce((sum, v) => sum + v * v, 0), radius2 = q.reduce((sum, v) => sum + v * v, 0) - projection * projection / length2;
    return e.semiMinorAxis * (Math.sqrt(Math.max(0, radius2)) - 1) < guardHeight;
}
/** Unweighted density integrals in meters. Spectral coefficients are applied at lookup time. */
export function solarOpticalColumns(model, p, steps = model.solarSteps) {
    if (solarBlocked(model, p)) return null;
    model.stats.solarIntegrations++;
    const bound = intersectEllipsoid(model.ellipsoid, p, model.sun, envelopeScale(model.ellipsoid, model.top));
    if (!bound || bound[1] <= 0) return [0, 0];
    const ds = bound[1] / steps, sum = [0, 0];
    for (let i = 0; i < steps; i++) {
        const rho = model.density(along(p, model.sun, (i + 0.5) * ds));
        sum[0] += rho[0] * ds; sum[1] += rho[1] * ds;
    }
    return sum;
}
export function geographicCoordinates(e, p) {
    const h = altitude(e, p), radial = Math.hypot(p[0], p[1]), e2 = 1 - (e.semiMinorAxis / e.semiMajorAxis) ** 2;
    let lat = Math.atan2(p[2], radial * (1 - e2));
    if (radial < 1e-8) lat = Math.sign(p[2]) * PI / 2;
    else for (let i = 0; i < 20; i++) {
        const s = Math.sin(lat), n = e.semiMajorAxis / Math.sqrt(1 - e2 * s * s);
        const next = Math.atan2(p[2] + e2 * n * s, radial);
        if (Math.abs(next - lat) < 1e-14) break;
        lat = next;
    }
    return { latitude: lat, longitude: Math.atan2(p[1], p[0]), height: h };
}
export class SolarOpticalLut {
    constructor(model, { longitude = 128, latitude = 32, altitude: height = 32, steps = 64, guardHeight = 20000 } = {}) {
        if (![longitude, latitude, height].every(n => Number.isInteger(n) && n >= 2 && n <= 512) || !Number.isInteger(steps) || steps < 1 || steps > 512) throw new Error('Invalid solar LUT dimensions or steps');
        if (!(guardHeight >= 0 && Number.isFinite(guardHeight))) throw new Error('Invalid solar grazing guard');
        this.guardHeight = guardHeight; this.model = model; this.size = [longitude, latitude, height]; this.steps = steps; this.signature = solarSignature(model);
        this.stats = { hits: 0, fallbacks: 0, shadowed: 0 };
    }
    assertCompatible(model = this.model) { if (solarSignature(model) !== this.signature) throw new Error('Solar LUT requires unchanged geometry, density profiles and solar declination'); }
    resetStats() { this.stats.hits = 0; this.stats.fallbacks = 0; this.stats.shadowed = 0; }
    /** Folded, warped relative longitude; latitude endpoints and quadratic altitude nodes are inclusive. */
    position(x, y, z, model = this.model) {
        const [nx, ny, nz] = this.size;
        return geodeticPosition(model.ellipsoid, y / (ny - 1) * PI - PI / 2,
            longitudeFromUnit(x / (nx - 1), y / (ny - 1) * PI - PI / 2, model.sun[2]) + Math.atan2(model.sun[1], model.sun[0]), Math.max(1e-5, model.top * (z / (nz - 1)) ** 2));
    }
    build() {
        const [nx, ny, nz] = this.size; this.data = new Float32Array(nx * ny * nz * 4);
        for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
            const columns = solarOpticalColumns(this.model, this.position(x, y, z), this.steps);
            if (columns) this.data.set([columns[0] / 1000, columns[1] / 1000, 0, 1], ((z * ny + y) * nx + x) * 4);
        }
        return this;
    }
    coordinates(p, model = this.model) {
        const geo = geographicCoordinates(model.ellipsoid, p), [nx, ny, nz] = this.size;
        if (geo.height < 0 || geo.height > model.top) return null;
        const longitude = wrapLongitude(geo.longitude - Math.atan2(model.sun[1], model.sun[0]));
        return [longitudeToUnit(longitude, geo.latitude, model.sun[2]) * (nx - 1), (geo.latitude / PI + 0.5) * (ny - 1), Math.sqrt(geo.height / model.top) * (nz - 1)];
    }
    transmittance(p, model = this.model) {
        this.assertCompatible(model);
        if (!this.data) throw new Error('Build CPU solar LUT before sampling');
        if (solarBlocked(model, p)) { this.stats.shadowed++; return [0, 0, 0]; }
        if (solarGrazesGround(model, p, this.guardHeight)) { this.stats.fallbacks++; return model.solarTransmittance(p); }
        const q = this.coordinates(p, model);
        if (!q) { this.stats.fallbacks++; return model.solarTransmittance(p); }
        const [nx, ny, nz] = this.size, base = q.map(Math.floor), f = q.map((v, i) => v - base[i]), columns = [0, 0];
        for (let corner = 0; corner < 8; corner++) {
            const weight = f.reduce((w, v, axis) => w * (corner & (1 << axis) ? v : 1 - v), 1);
            if (weight < 1e-12) continue;
            const x = Math.min(nx - 1, base[0] + (corner & 1)), y = Math.min(ny - 1, base[1] + ((corner >> 1) & 1)), z = Math.min(nz - 1, base[2] + ((corner >> 2) & 1));
            const offset = ((z * ny + y) * nx + x) * 4;
            if (this.data[offset + 3] < 1) { this.stats.fallbacks++; return model.solarTransmittance(p); }
            columns[0] += weight * this.data[offset]; columns[1] += weight * this.data[offset + 1];
        }
        this.stats.hits++;
        return model.rayleigh.map(beta => Math.exp(-1000 * (beta * columns[0] + model.mieExtinction * columns[1])));
    }
    get bytes() { return this.size.reduce((a, b) => a * b, 1) * 8; }
}
