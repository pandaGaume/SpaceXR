import { along, atmosphericInterval, dot } from './geometry.js';
/** Single scattering reference and accelerated integrator share the same physical equations.
 * Tree caches solar transmittance only; view-dependent radiance is never stored as a scalar per cell.
 */
export function integrate(model, origin, direction, { tree = null, eyes = [origin], maxStep = 2000, maxDistance = Infinity, g = 0.8 } = {}) {
    if (!(maxStep > 0 && Number.isFinite(maxStep)) || !(maxDistance > 0) || !(Math.abs(g) < 1)) throw new Error('Invalid integration settings');
    if (tree && tree.model !== model) throw new Error('Tree belongs to another atmosphere');
    tree?.assertValid();
    const interval = atmosphericInterval(model, origin, direction, maxDistance);
    const radiance = [0, 0, 0], transmittance = [1, 1, 1];
    let samples = 0;
    if (!interval) return { radiance, transmittance, samples };
    const d = interval.direction, mu = dot(d, model.sun);
    const phaseR = 3 * (1 + mu * mu) / (16 * Math.PI);
    const phaseM = 3 * (1 - g * g) * (1 + mu * mu) / (8 * Math.PI * (2 + g * g) * (1 + g * g - 2 * g * mu) ** 1.5);
    let t = interval.start;
    while (t < interval.end) {
        let ds = Math.min(maxStep, interval.end - t), lookup;
        if (tree) {
            // The probe selects the next cell at exact shared faces. Integration itself has no gaps.
            const probe = along(origin, d, Math.min(interval.end, t + 1e-5));
            lookup = tree.locate(probe, eyes);
            const exit = tree.exitDistance(lookup.cell, along(origin, d, t), d);
            if (exit > 1e-6) ds = Math.min(interval.end - t, lookup.empty ? exit : Math.min(ds, exit));
            if (lookup.empty) { tree.stats.skippedMeters += ds; t += ds; continue; }
        }
        const p = along(origin, d, t + ds / 2), density = model.density(p);
        if (density[0] || density[1]) {
            const solar = tree ? tree.solar(p, lookup) : model.solarTransmittance(p);
            const extinction = model.extinction(density);
            for (let c = 0; c < 3; c++) {
                const source = solar[c] * (model.rayleigh[c] * density[0] * phaseR + model.mieScattering * density[1] * phaseM);
                const stepT = Math.exp(-extinction[c] * ds);
                const weight = extinction[c] > 0 ? -Math.expm1(-extinction[c] * ds) / extinction[c] : ds;
                radiance[c] += transmittance[c] * source * weight;
                transmittance[c] *= stepT;
            }
            samples++;
        }
        t += ds;
    }
    return { radiance, transmittance, samples };
}
