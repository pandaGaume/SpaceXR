import { altitude, along, atmosphericInterval } from './geometry.js';
/** One identical lattice for three GPU representations: storage buffer, texture3D and atlas2D.
 * Cell validity is conservative in geodetic altitude and rejects every shadowed corner.
 */
export function buildSolarGrid(model, origin, rays, dimension = 32) {
    if (!Number.isInteger(dimension) || dimension < 2 || dimension > 64) throw new Error('Grid dimension must be in [2, 64]');
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const ray of rays) {
        const interval = atmosphericInterval(model, origin, ray);
        if (!interval) continue;
        for (const t of [interval.start, interval.end]) {
            const p = along(origin, interval.direction, t);
            for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], p[c]); max[c] = Math.max(max[c], p[c]); }
        }
    }
    if (!Number.isFinite(min[0])) throw new Error('No atmosphere in view');
    for (let c = 0; c < 3; c++) { min[c] -= 1; max[c] += 1; }
    const n = dimension, step = min.map((v, c) => (max[c] - v) / (n - 1));
    const data = new Float32Array(n ** 3 * 4), flags = new Uint32Array(n ** 3);
    const index = (x, y, z) => x + n * (y + n * z);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const p = [x, y, z].map((v, c) => min[c] + step[c] * v);
        const h = altitude(model.ellipsoid, p);
        if (h < 0 || h > model.top) continue;
        const value = model.solarTransmittance(p), offset = index(x, y, z) * 4;
        data.set([...value, value.some(v => v > 0) ? 1 : 0], offset);
    }
    const radius = Math.hypot(...step) / 2;
    for (let z = 0; z < n - 1; z++) for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
        const center = [x + 0.5, y + 0.5, z + 0.5].map((v, c) => min[c] + step[c] * v);
        const h = altitude(model.ellipsoid, center);
        if (h < radius || h + radius > model.top) continue;
        let valid = true;
        for (let k = 0; k < 8; k++) if (!data[index(x + (k & 1), y + ((k >> 1) & 1), z + ((k >> 2) & 1)) * 4 + 3]) valid = false;
        if (valid) flags[index(x, y, z)] = 1;
    }
    return { min, step, dimension, data, flags };
}
export function sampleSolarGrid(grid, p) {
    const n = grid.dimension, q = p.map((v, c) => (v - grid.min[c]) / grid.step[c]);
    const cell = q.map(Math.floor), u = q.map((v, c) => v - cell[c]);
    if (cell.some(v => v < 0 || v >= n - 1)) return null;
    const index = (x, y, z) => x + n * (y + n * z);
    if (!grid.flags[index(...cell)]) return null;
    const result = [0, 0, 0];
    for (let k = 0; k < 8; k++) {
        const offset = index(cell[0] + (k & 1), cell[1] + ((k >> 1) & 1), cell[2] + ((k >> 2) & 1)) * 4;
        const weight = u.reduce((w, v, c) => w * (k & (1 << c) ? v : 1 - v), 1);
        for (let c = 0; c < 3; c++) result[c] += weight * grid.data[offset + c];
    }
    return result;
}
/** Round IEEE float32 values to float16 for filterable RGBA16F textures. */
export function toFloat16(values) {
    const words = new Uint32Array(values.buffer, values.byteOffset, values.length), result = new Uint16Array(values.length);
    for (let i = 0; i < words.length; i++) {
        const bits = words[i], sign = (bits >>> 16) & 0x8000, exponent = ((bits >>> 23) & 255) - 127 + 15, mantissa = bits & 0x7fffff;
        if (exponent >= 31) result[i] = sign | 0x7c00;
        else if (exponent <= 0) {
            if (exponent < -10) result[i] = sign;
            else { const shift = 14 - exponent; result[i] = sign | (((mantissa | 0x800000) + (1 << (shift - 1)) - 1 + (((mantissa | 0x800000) >>> shift) & 1)) >>> shift); }
        } else result[i] = sign | ((exponent << 10) + ((mantissa + 0xfff + ((mantissa >>> 13) & 1)) >>> 13));
    }
    return result;
}
