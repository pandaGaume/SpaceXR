import { altitude, along, atmosphericInterval, dot, inside, intersectEllipsoid, normalize } from './geometry.js';
import { integrate, integrateProfile } from './integrator.js';

export class FrustumCamera {
    constructor(origin, forward, right, up, halfWidth = 0.7, halfHeight = 0.45) {
        if (origin.length !== 3 || !origin.every(Number.isFinite) || !(halfWidth > 0 && halfHeight > 0 && Number.isFinite(halfWidth) && Number.isFinite(halfHeight))) throw new Error('Invalid camera');
        this.origin = [...origin]; this.forward = normalize(forward); this.right = normalize(right); this.up = normalize(up);
        if ([dot(this.forward, this.right), dot(this.forward, this.up), dot(this.right, this.up)].some(v => Math.abs(v) > 1e-6)) throw new Error('Camera basis must be orthogonal');
        this.halfWidth = halfWidth; this.halfHeight = halfHeight;
        for (const vector of [this.origin, this.forward, this.right, this.up]) Object.freeze(vector);
        Object.freeze(this);
    }
    ray(u, v) {
        return normalize(this.forward.map((f, i) => f + (2 * u - 1) * this.halfWidth * this.right[i] + (1 - 2 * v) * this.halfHeight * this.up[i]));
    }
}
export function frustumLayout(camera, { width = 12, height = 8, depth = 48, far = 2000000 } = {}) {
    if (![width, height, depth].every(n => Number.isInteger(n) && n >= 2 && n <= 256) || !(far > 0 && Number.isFinite(far))) throw new Error('Invalid froxel dimensions');
    const depths = Array.from({ length: depth }, (_, z) => far * (z / (depth - 1)) ** 3);
    const rays = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rays.push(camera.ray(x / (width - 1), y / (height - 1)));
    return { width, height, depth, far, depths, rays };
}
/** Camera-dependent cumulative radiance and RGB transmittance; shared spatial solar cache. */
export class FrustumVolume {
    constructor(model, tree, camera, options = {}) {
        if (tree && tree.model !== model) throw new Error('Tree belongs to another atmosphere');
        if (inside(model.ellipsoid, camera.origin)) throw new Error('Camera must be above the ellipsoid');
        this.model = model; this.tree = tree; this.camera = camera;
        Object.assign(this, frustumLayout(camera, options));
        this.solarLut = options.solarLut ?? null;
        this.maxStep = options.maxStep ?? 2000;
        this.light = new Float32Array(options.allocateData === false ? 0 : this.width * this.height * this.depth * 4);
        this.transmission = new Float32Array(this.light.length);
        this.groundDepths = new Float64Array(this.rays.length);
        this.stats = { lookups: 0, fallbacks: 0, integratedSamples: 0 };
        this.rays.forEach((ray, i) => {
            const ground = intersectEllipsoid(this.model.ellipsoid, this.camera.origin, ray);
            this.groundDepths[i] = ground && ground[0] >= 0 ? ground[0] * dot(ray, this.camera.forward) : Infinity;
        });
    }
    build() {
        if (!this.light.length) {
            this.light = new Float32Array(this.width * this.height * this.depth * 4);
            this.transmission = new Float32Array(this.light.length);
        }
        const count = this.rays.length;
        for (let i = 0; i < count; i++) {
            const ray = this.rays[i], cosine = dot(ray, this.camera.forward);
            const ground = intersectEllipsoid(this.model.ellipsoid, this.camera.origin, ray);
            this.groundDepths[i] = ground && ground[0] >= 0 ? ground[0] * cosine : Infinity;
            const values = integrateProfile(this.model, this.camera.origin, ray, this.depths.map(z => z / cosine), { tree: this.tree, solarLut: this.solarLut, maxStep: this.maxStep });
            values.forEach((value, z) => {
                const index = (z * count + i) * 4;
                this.light.set([...value.radiance, 1], index); this.transmission.set([...value.transmittance, 1], index);
            });
            this.stats.integratedSamples += values.at(-1).samples;
        }
        this.built = true; return this;
    }
    target(u, v, maxDistance = Infinity) {
        const ray = this.camera.ray(u, v), interval = atmosphericInterval(this.model, this.camera.origin, ray, maxDistance);
        return { ray, distance: interval?.end ?? 0, depth: (interval?.end ?? 0) * dot(ray, this.camera.forward) };
    }
    /** Reject horizon-straddling angular cells instead of interpolating across the planet silhouette. */
    coordinates(u, v, requestedDepth) {
        if (![u, v, requestedDepth].every(Number.isFinite) || u < 0 || u > 1 || v < 0 || v > 1 || requestedDepth < 0 || requestedDepth > this.far) return null;
        // A coarse angular footprint cannot safely reconstruct the clipped ground boundary.
        // Preserve the ellipsoidal silhouette through direct integration in this band.
        if (requestedDepth > 0) {
            const ray = this.camera.ray(u, v), distance = requestedDepth / dot(ray, this.camera.forward);
            const footprint = requestedDepth * Math.hypot(this.camera.halfWidth / (this.width - 1), this.camera.halfHeight / (this.height - 1));
            if (altitude(this.model.ellipsoid, along(this.camera.origin, ray, distance)) < footprint) return null;
        }
        const fx = u * (this.width - 1), fy = v * (this.height - 1);
        const x = Math.min(this.width - 2, Math.floor(fx)), y = Math.min(this.height - 2, Math.floor(fy));
        const angular = [x + y * this.width, x + 1 + y * this.width, x + (y + 1) * this.width, x + 1 + (y + 1) * this.width];
        const ground = angular.map(i => Number.isFinite(this.groundDepths[i]));
        if (ground.some(Boolean) && !ground.every(Boolean) && requestedDepth >= Math.min(...angular.map(i => this.groundDepths[i]))) return null;
        let z = 0;
        while (z < this.depth - 2 && this.depths[z + 1] < requestedDepth) z++;
        const fraction = (requestedDepth - this.depths[z]) / (this.depths[z + 1] - this.depths[z]);
        return { x, y, z, weights: [fx - x, fy - y, fraction] };
    }
    lookup(u, v, requestedDepth) {
        if (!this.built) throw new Error('Build volume before sampling');
        const coordinates = this.coordinates(u, v, requestedDepth);
        if (!coordinates) return null;
        const { x, y, z, weights } = coordinates, radiance = [0, 0, 0], transmittance = [0, 0, 0];
        for (let corner = 0; corner < 8; corner++) {
            const ix = x + (corner & 1), iy = y + ((corner >> 1) & 1), iz = z + ((corner >> 2) & 1);
            const weight = weights.reduce((w, value, axis) => w * (corner & (1 << axis) ? value : 1 - value), 1);
            const index = ((iz * this.height + iy) * this.width + ix) * 4;
            for (let c = 0; c < 3; c++) { radiance[c] += weight * this.light[index + c]; transmittance[c] += weight * this.transmission[index + c]; }
        }
        this.stats.lookups++;
        return { radiance, transmittance, samples: 0, fallback: false };
    }
    sample(u, v, maxDistance = Infinity) {
        if (!(maxDistance >= 0)) throw new Error('Invalid scene depth');
        const target = this.target(u, v, maxDistance);
        const value = this.lookup(u, v, target.depth);
        if (value) return value;
        this.stats.fallbacks++;
        if (maxDistance === 0) return { radiance: [0, 0, 0], transmittance: [1, 1, 1], samples: 0, fallback: true };
        return { ...integrate(this.model, this.camera.origin, target.ray, { tree: this.tree, solarLut: this.solarLut, maxStep: this.maxStep, maxDistance }), fallback: true };
    }
    get bytes() { return this.light.byteLength + this.transmission.byteLength + this.groundDepths.byteLength; }
}
