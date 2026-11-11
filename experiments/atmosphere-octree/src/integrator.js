import { along, atmosphericInterval, dot } from './geometry.js';
/** Integrate increasing physical ray distances in one traversal. Each checkpoint is cumulative. */
export function integrateProfile(model, origin, direction, distances, { tree = null, solarLut = null, eyes = [origin], maxStep = 2000, g = 0.8 } = {}) {
    if (!(maxStep > 0 && Number.isFinite(maxStep)) || !(Math.abs(g) < 1) || !distances.length || distances.some((v, i) => !(v >= 0) || (i > 0 && v <= distances[i - 1]))) throw new Error('Invalid integration settings');
    if (tree && solarLut) throw new Error('Choose one solar cache');
    solarLut?.assertCompatible(model);
    if (tree && tree.model !== model) throw new Error('Tree belongs to another atmosphere');
    tree?.assertValid();
    const interval = atmosphericInterval(model, origin, direction, distances.at(-1));
    const radiance = [0, 0, 0], transmittance = [1, 1, 1], profile = [];
    let samples = 0, t = interval?.start ?? 0;
    const d = interval?.direction, mu = d ? dot(d, model.sun) : 0;
    const phaseR = 3 * (1 + mu * mu) / (16 * Math.PI);
    const phaseM = 3 * (1 - g * g) * (1 + mu * mu) / (8 * Math.PI * (2 + g * g) * (1 + g * g - 2 * g * mu) ** 1.5);
    for (const distance of distances) {
        const end = interval ? Math.min(interval.end, distance) : 0;
        while (t < end) {
            let ds = Math.min(maxStep, end - t), lookup;
            if (tree) {
                const probe = along(origin, d, Math.min(end, t + 1e-5));
                lookup = tree.locate(probe, eyes);
                const exit = tree.exitDistance(lookup.cell, along(origin, d, t), d);
                if (exit > 1e-6) ds = Math.min(end - t, lookup.empty ? exit : Math.min(ds, exit));
                if (lookup.empty) { tree.stats.skippedMeters += ds; t += ds; continue; }
            }
            const p = along(origin, d, t + ds / 2), density = model.density(p);
            if (density[0] || density[1]) {
                const solar = solarLut ? solarLut.transmittance(p, model) : tree ? tree.solar(p, lookup) : model.solarTransmittance(p), extinction = model.extinction(density);
                for (let c = 0; c < 3; c++) {
                    const source = solar[c] * (model.rayleigh[c] * density[0] * phaseR + model.mieScattering * density[1] * phaseM);
                    const stepT = Math.exp(-extinction[c] * ds);
                    const weight = extinction[c] > 0 ? -Math.expm1(-extinction[c] * ds) / extinction[c] : ds;
                    radiance[c] += transmittance[c] * source * weight; transmittance[c] *= stepT;
                }
                samples++;
            }
            t += ds;
        }
        profile.push({ radiance: [...radiance], transmittance: [...transmittance], samples });
    }
    return profile;
}
/** Single ray convenience API. Outputs linear radiance for unit solar illumination. */
export function integrate(model, origin, direction, { maxDistance = Infinity, ...options } = {}) {
    if (!(maxDistance > 0)) throw new Error('Invalid maximum distance');
    return integrateProfile(model, origin, direction, [maxDistance], options)[0];
}
