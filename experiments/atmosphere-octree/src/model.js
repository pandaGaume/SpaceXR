import { WGS84, altitude, along, envelopeScale, inside, intersectEllipsoid, normalize, validateEllipsoid } from './geometry.js';
export class Atmosphere {
    constructor({ ellipsoid = WGS84, top = 100000, rayleighHeight = 8000, mieHeight = 1200,
        rayleigh = [5.802e-6, 13.558e-6, 33.1e-6], mieScattering = 3.996e-6, mieExtinction = 4.44e-6,
        sun = [1, 0, 0], solarSteps = 64 } = {}) {
        validateEllipsoid(ellipsoid);
        if (![top, rayleighHeight, mieHeight].every(x => Number.isFinite(x) && x > 0) || !Number.isInteger(solarSteps) || solarSteps < 1) throw new Error('Invalid atmosphere sampling parameters');
        if (rayleigh.length !== 3 || !rayleigh.every(x => Number.isFinite(x) && x >= 0) || !(mieScattering >= 0 && mieExtinction >= mieScattering && Number.isFinite(mieExtinction))) throw new Error('Invalid optical coefficients');
        this.ellipsoid = Object.freeze({ semiMajorAxis: ellipsoid.semiMajorAxis, semiMinorAxis: ellipsoid.semiMinorAxis });
        this.top = top; this.rayleighHeight = rayleighHeight; this.mieHeight = mieHeight;
        this.rayleigh = Object.freeze([...rayleigh]); this.mieScattering = mieScattering; this.mieExtinction = mieExtinction;
        this.sun = Object.freeze(normalize(sun)); this.solarSteps = solarSteps;
        this.stats = { densityEvaluations: 0, solarIntegrations: 0 };
        Object.freeze(this);
    }
    resetStats() { this.stats.densityEvaluations = 0; this.stats.solarIntegrations = 0; }
    density(p) {
        this.stats.densityEvaluations++;
        const h = altitude(this.ellipsoid, p);
        return h < 0 || h > this.top ? [0, 0] : [Math.exp(-h / this.rayleighHeight), Math.exp(-h / this.mieHeight)];
    }
    extinction(density) { return this.rayleigh.map(r => r * density[0] + this.mieExtinction * density[1]); }
    solarTransmittance(p, steps = this.solarSteps) {
        this.stats.solarIntegrations++;
        if (inside(this.ellipsoid, p)) return [0, 0, 0];
        const ground = intersectEllipsoid(this.ellipsoid, p, this.sun);
        if (ground && ground[1] > 1e-4 && ground[0] >= -1e-4) return [0, 0, 0];
        const bound = intersectEllipsoid(this.ellipsoid, p, this.sun, envelopeScale(this.ellipsoid, this.top));
        if (!bound || bound[1] <= 0) return [1, 1, 1];
        const length = bound[1], ds = length / steps, optical = [0, 0, 0];
        for (let i = 0; i < steps; i++) {
            const extinction = this.extinction(this.density(along(p, this.sun, (i + 0.5) * ds)));
            for (let c = 0; c < 3; c++) optical[c] += extinction[c] * ds;
        }
        return optical.map(t => Math.exp(-t));
    }
}

