import { altitude, envelopeScale, intersectEllipsoid, norm } from './geometry.js';

class Cell {
    constructor(center, half, depth) { this.center = center; this.half = half; this.depth = depth; this.children = new Array(8); this.corners = null; }
}
/** Persistent lazy octree. Only queried (observed) branches are refined.
 * The solar ray always integrates the global analytic medium, including outside the view.
 */
export class AtmosphereOctree {
    constructor(model, { maxDepth = 12, minCellSize = 1500, maxCellSize = 24000, angularSize = 0.08, densityTolerance = 0.02, maxNodes = 30000, seamBlendFraction = 0.08 } = {}) {
        if (!(seamBlendFraction >= 0 && seamBlendFraction <= 0.5)) throw new Error('Invalid seam blend width');
        if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 24 || !Number.isInteger(maxNodes) || maxNodes < 1 ||
            ![minCellSize, maxCellSize, angularSize, densityTolerance].every(x => Number.isFinite(x) && x > 0) || minCellSize > maxCellSize) throw new Error('Invalid octree limits');
        this.model = model; this.options = { maxDepth, minCellSize, maxCellSize, angularSize, densityTolerance, maxNodes, seamBlendFraction };
        this.root = new Cell([0, 0, 0], model.ellipsoid.semiMajorAxis * envelopeScale(model.ellipsoid, model.top), 0);
        this.nodes = 1; this.cornerCache = new Map();
        this.stats = { hits: 0, misses: 0, direct: 0, lookups: 0, skippedMeters: 0, blended: 0 };
        this.signature = this.modelSignature();
    }
    modelSignature() { const m = this.model; return JSON.stringify([m.ellipsoid, m.top, m.rayleighHeight, m.mieHeight, m.rayleigh, m.mieExtinction, m.sun, m.solarSteps]); }
    resetStats() { for (const k of Object.keys(this.stats)) this.stats[k] = 0; }
    clearLighting() {
        this.cornerCache.clear();
        const clear = cell => { cell.corners = null; for (const child of cell.children) if (child) clear(child); };
        clear(this.root); this.signature = this.modelSignature();
    }
    assertValid() {
        if (this.modelSignature() !== this.signature) throw new Error('Atmosphere changed: construct a new tree (or clearLighting for lighting-only changes)');
    }
    bounds(cell) {
        const e = this.model.ellipsoid, r = Math.sqrt(3) * cell.half;
        const h = altitude(e, cell.center);
        const far = cell.center.map(v => Math.abs(v) + cell.half);
        const ground = (far[0] / e.semiMajorAxis) ** 2 + (far[1] / e.semiMajorAxis) ** 2 + (far[2] / e.semiMinorAxis) ** 2 < 1;
        // Exterior altitude is distance to a convex body and is 1-Lipschitz.
        return { low: h < 0 ? -r : h - r, high: h < 0 ? r : h + r, ground };
    }
    locate(p, eyes) {
        this.stats.lookups++;
        let cell = this.root;
        while (true) {
            const { low, high, ground } = this.bounds(cell);
            if (ground || low > this.model.top) return { cell, empty: true, cacheable: false };
            const size = 2 * cell.half, o = this.options;
            const distance = Math.max(1, Math.min(...eyes.map(eye => Math.max(0, norm(cell.center.map((v, i) => v - eye[i])) - Math.sqrt(3) * cell.half))));
            const m = this.model, h = Math.max(0, low);
            const opticalVariation = size * (Math.max(...m.rayleigh) * Math.exp(-h / m.rayleighHeight) * (1 - Math.exp(-size / m.rayleighHeight)) + m.mieExtinction * Math.exp(-h / m.mieHeight) * (1 - Math.exp(-size / m.mieHeight)));
            const refine = size > o.maxCellSize || (size > o.minCellSize && (size / distance > o.angularSize || opticalVariation > o.densityTolerance));
            if (!refine || cell.depth >= o.maxDepth) return { cell, empty: false, cacheable: low >= 0 && high <= this.model.top };
            const index = p.reduce((bits, value, i) => bits | (value >= cell.center[i] ? 1 << i : 0), 0);
            if (!cell.children[index]) {
                // A budget-limited coarse cell is evaluated directly instead of silently using an inaccurate cache.
                if (this.nodes >= o.maxNodes) return { cell, empty: false, cacheable: false };
                const half = cell.half / 2;
                cell.children[index] = new Cell(cell.center.map((v, i) => v + (index & (1 << i) ? half : -half)), half, cell.depth + 1);
                this.nodes++;
            }
            cell = cell.children[index];
        }
    }
    solar(p, lookup) {
        const m = this.model;
        const shadow = intersectEllipsoid(m.ellipsoid, p, m.sun);
        if (shadow && shadow[1] > 1e-4 && shadow[0] >= -1e-4) return [0, 0, 0];
        if (!lookup.cacheable) { this.stats.direct++; return m.solarTransmittance(p); }
        const cell = lookup.cell;
        if (!cell.corners) {
            this.stats.misses++;
            cell.corners = Array.from({ length: 8 }, (_, index) => {
                const corner = cell.center.map((v, i) => v + (index & (1 << i) ? cell.half : -cell.half));
                const key = corner.join(',');
                let value = this.cornerCache.get(key);
                if (!value) { value = m.solarTransmittance(corner); this.cornerCache.set(key, value); }
                return value;
            });
        } else this.stats.hits++;
        // Avoid interpolating across the geometric shadow boundary.
        if (cell.corners.some(c => c.every(v => v === 0))) { this.stats.direct++; return m.solarTransmittance(p); }
        const u = p.map((v, i) => Math.max(0, Math.min(1, (v - cell.center[i] + cell.half) / (2 * cell.half))));
        const result = [0, 0, 0];
        for (let index = 0; index < 8; index++) {
            const weight = u.reduce((w, v, i) => w * (index & (1 << i) ? v : 1 - v), 1);
            for (let c = 0; c < 3; c++) result[c] += weight * cell.corners[index][c];
        }
        const fraction = this.options.seamBlendFraction;
        const margin = Math.min(...u.map(v => Math.min(v, 1 - v)));
        if (fraction > 0 && margin < fraction) {
            // Every cell face converges to the same direct integral, across LODs too.
            const x = Math.max(0, margin / fraction), weight = x * x * (3 - 2 * x);
            const direct = m.solarTransmittance(p); this.stats.blended++;
            return result.map((v, c) => direct[c] + weight * (v - direct[c]));
        }
        return result;
    }
    /** Physical distance until exiting the selected cell. */
    exitDistance(cell, p, d) {
        let distance = Infinity;
        for (let i = 0; i < 3; i++) if (Math.abs(d[i]) > 1e-15) {
            const edge = cell.center[i] + (d[i] > 0 ? cell.half : -cell.half);
            distance = Math.min(distance, (edge - p[i]) / d[i]);
        }
        return Math.max(0, distance);
    }
}
