import { add, dot, geodeticPosition, intersectEllipsoid, mul, norm } from './geometry.js';
import { geographicCoordinates } from './solar-lut.js';
import { skyBasis } from './sky-view.js';
import { FrustumCamera } from './frustum.js';
const applyQ = (e, v) => [v[0] / e.semiMajorAxis ** 2, v[1] / e.semiMajorAxis ** 2, v[2] / e.semiMinorAxis ** 2];
function conic(e, camera, u, v) {
    const p = camera.origin, r = camera.forward.map((x, i) => x + (2 * u - 1) * camera.halfWidth * camera.right[i] + (1 - 2 * v) * camera.halfHeight * camera.up[i]);
    const qp = applyQ(e, p), qr = applyQ(e, r), pr = dot(p, qr), rr = dot(r, qr), c = dot(p, qp) - 1;
    const derivative = dr => 2 * pr * dot(qp, dr) - 2 * c * dot(qr, dr);
    return { value: pr * pr - c * rr, positionDerivative: qr.map((x, i) => 2 * pr * x - 2 * rr * qp[i]),
        du: derivative(mul(camera.right, 2 * camera.halfWidth)), dv: derivative(mul(camera.up, -2 * camera.halfHeight)), forwardDistance: -pr / rr };
}
function quadraticRoots(a, b, c) {
    const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
    if (Math.abs(a) < scale * 1e-14) return Math.abs(b) > scale * 1e-14 ? [-c / b] : [];
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -1e-12 * (b * b + Math.abs(4 * a * c))) return [];
    const root = Math.sqrt(Math.max(0, discriminant)), q = -0.5 * (b + (b < 0 ? -root : root));
    return q === 0 ? [-b / (2 * a)] : [q / a, c / q];
}
/** Implicit projected ellipsoid conic, with derivatives in pixels per ECEF meter. */
export function horizonSensitivity(ellipsoid, camera, width, height, samples = 33) {
    const points = [], keys = new Set(), p = camera.origin, qp = applyQ(ellipsoid, p), c = dot(p, qp) - 1;
    const scan = (fixed, vertical) => {
        const a = camera.forward.map((v, i) => v + (vertical ? (2 * fixed - 1) * camera.halfWidth * camera.right[i] + camera.halfHeight * camera.up[i] : -camera.halfWidth * camera.right[i] + (1 - 2 * fixed) * camera.halfHeight * camera.up[i]));
        const b = mul(vertical ? camera.up : camera.right, vertical ? -2 * camera.halfHeight : 2 * camera.halfWidth);
        const qa = applyQ(ellipsoid, a), qb = applyQ(ellipsoid, b), pa = dot(p, qa), pb = dot(p, qb);
        for (const root of quadraticRoots(pb * pb - c * dot(b, qb), 2 * (pa * pb - c * dot(a, qb)), pa * pa - c * dot(a, qa))) {
            if (root < 0 || root > 1) continue;
            const u = vertical ? fixed : root, v = vertical ? root : fixed, value = conic(ellipsoid, camera, u, v);
            if (value.forwardDistance <= 0) continue;
            const gradient = [value.du / width, value.dv / height], denominator = Math.hypot(...gradient);
            if (!(denominator > 0)) continue;
            const key = `${Math.round(u * 1e7)},${Math.round(v * 1e7)}`;
            if (keys.has(key)) continue; keys.add(key);
            points.push({ u, v, normal: gradient.map(x => x / denominator), jacobian: value.positionDerivative.map(x => -x / denominator) });
        }
    };
    for (let i = 0; i < samples; i++) { scan(i / (samples - 1), true); scan(i / (samples - 1), false); }
    return { width, height, points };
}
export function predictedHorizonShift(sensitivity, displacement) {
    return sensitivity.points.reduce((maximum, p) => Math.max(maximum, Math.abs(dot(p.jacobian, displacement))), 0);
}
/** Compare the analytical first-order formula with a new conic solved along each original screen normal. */
export function measuredHorizonShift(ellipsoid, camera, sensitivity) {
    let maximum = 0;
    for (const point of sensitivity.points) {
        let distance = 0;
        for (let i = 0; i < 12; i++) {
            const u = point.u + distance * point.normal[0] / sensitivity.width, v = point.v + distance * point.normal[1] / sensitivity.height;
            const value = conic(ellipsoid, camera, u, v);
            const derivative = value.du / sensitivity.width * point.normal[0] + value.dv / sensitivity.height * point.normal[1];
            if (Math.abs(derivative) < 1e-30) return Infinity;
            const step = value.value / derivative; distance -= step;
            if (Math.abs(step) < 1e-7) break;
        }
        maximum = Math.max(maximum, Math.abs(distance));
    }
    return maximum;
}
export function movedCamera(model, camera, basis, offset) {
    const delta = basis.east.map((v, i) => v * offset[0] + basis.north[i] * offset[1] + basis.up[i] * offset[2]);
    let origin = add(camera.origin, delta);
    // Horizontal moves follow a constant geodetic altitude, instead of drifting up a tangent plane.
    const h = geographicCoordinates(model.ellipsoid, camera.origin).height;
    const geo = geographicCoordinates(model.ellipsoid, origin);
    origin = geodeticPosition(model.ellipsoid, geo.latitude, geo.longitude, h + offset[2]);
    if (h + offset[2] < 0) throw new Error('Calibration displacement enters the ellipsoid');
    return new FrustumCamera(origin, camera.forward, camera.right, camera.up, camera.halfWidth, camera.halfHeight);
}
function probeRays(camera, sensitivity) {
    const rays = [], keys = new Set();
    const addProbe = (u, v) => {
        if (u < 0 || u > 1 || v < 0 || v > 1) return;
        const key = `${u.toFixed(8)},${v.toFixed(8)}`;
        if (!keys.has(key)) { keys.add(key); rays.push(camera.ray(u, v)); }
    };
    for (let y = 0; y < 14; y++) for (let x = 0; x < 24; x++) addProbe((x + 0.5) / 24, (y + 0.5) / 14);
    for (let i = 0; i < sensitivity.points.length; i += Math.max(1, Math.floor(sensitivity.points.length / 16))) {
        const p = sensitivity.points[i];
        for (const shift of [-8, -3, -1, 1, 3, 8]) addProbe(p.u + p.normal[0] * shift / sensitivity.width, p.v + p.normal[1] * shift / sensitivity.height);
    }
    return rays;
}
const displayCode = (value, exposure) => 255 * Math.pow(1 - Math.exp(-Math.max(0, value) * exposure), 1 / 2.2);
export function colorResidual(cached, fresh, ground, exposure) {
    const base = [0.005, 0.007, 0.01], residual = [];
    cached.forEach((value, i) => value.radiance.forEach((v, c) => {
        const a = v + (ground[i] ? base[c] * value.transmittance[c] : 0), b = fresh[i].radiance[c] + (ground[i] ? base[c] * fresh[i].transmittance[c] : 0);
        residual.push(displayCode(a, exposure) - displayCode(b, exposure));
    }));
    return residual;
}
export function colorBudget(sensitivity, localOffset) { return sensitivity.reduce((sum, s, i) => sum + s * Math.abs(localOffset[i]), 0); }
/** Dimensionless local reuse score; offsets are east, north, altitude in meters. */
export function reuseScore(geometry, basis, sensitivity, offset, { pixelBudget = 0.5, codeBudget = 2 } = {}) {
    if (!(pixelBudget > 0 && codeBudget > 0)) throw new Error('Positive reuse budgets required');
    const displacement = basis.east.map((v,i) => v * offset[0] + basis.north[i] * offset[1] + basis.up[i] * offset[2]);
    return Math.max(predictedHorizonShift(geometry, displacement) / pixelBudget, colorBudget(sensitivity, offset) / codeBudget);
}
/** Constant-velocity prediction only. Recompute after a view, speed or model change. */
export function reuseDuration(geometry, basis, sensitivity, velocity, options = {}) {
    const rate = reuseScore(geometry, basis, sensitivity, velocity, options);
    return rate > 0 ? (options.safetyFactor ?? 0.5) / rate : Infinity;
}
export function axisReuseLimits(geometry, basis, colorSensitivity, pixelBudget, codeBudget, range) {
    return [basis.east, basis.north, basis.up].map((axis, i) => {
        const geometryPerMeter = predictedHorizonShift(geometry, axis), colorPerMeter = colorSensitivity[i];
        return { geometryPixelsPerMeter: geometryPerMeter, colorCodesPerMeter: colorPerMeter,
            geometricLimitMeters: geometryPerMeter > 0 ? pixelBudget / geometryPerMeter : null,
            photometricLimitMeters: colorPerMeter > 0 ? codeBudget / colorPerMeter : null,
            extrapolationCapMeters: range[i], firstOrderLimitMeters: Math.min(geometryPerMeter > 0 ? pixelBudget / geometryPerMeter : Infinity, colorPerMeter > 0 ? codeBudget / colorPerMeter : Infinity, range[i]) };
    });
}
/** Six directional samples fit the color formula; independent mixed moves check its validity. */
export async function calibrateSkyReuse(renderer, { pixelBudget = 0.5, codeBudget = 2, onProgress = () => {} } = {}) {
    if (!(pixelBudget > 0 && codeBudget > 0)) throw new Error('Positive reuse budgets required');
    const start = performance.now(), camera = renderer.camera, model = renderer.model, basis = skyBasis(model.ellipsoid, camera.origin);
    const geometry = horizonSensitivity(model.ellipsoid, camera, renderer.width, renderer.height), rays = probeRays(camera, geometry);
    await renderer.sampleRays(rays); // Compile once and share this probe pipeline with all fresh reference LUTs.
    const h = Math.max(1, geographicCoordinates(model.ellipsoid, camera.origin).height);
    const steps = [Math.min(1000, Math.max(10, h * 0.01)), Math.min(1000, Math.max(10, h * 0.01)), Math.min(100, Math.max(1, h * 0.001))];
    const range = steps.map(x => x * 32), samples = [], calibrationResiduals = [];
    const evaluate = async (offset, label) => {
        onProgress(label);
        const shifted = movedCamera(model, camera, basis, offset), fresh = renderer.cloneForCamera(shifted), wallStart = performance.now();
        try {
            const build = await fresh.build(), reference = await fresh.sampleRays(rays);
            const cached = await renderer.sampleAtCamera(rays, shifted, fresh.layout);
            const ground = rays.map(ray => { const hit = intersectEllipsoid(model.ellipsoid, shifted.origin, ray); return !!(hit && hit[0] >= 0); });
            const residual = colorResidual(cached, reference, ground, renderer.exposure);
            const displacement = shifted.origin.map((v, i) => v - camera.origin[i]);
            const item = { label, localOffsetMeters: offset, actualDistanceMeters: norm(displacement), predictedHorizonPixels: predictedHorizonShift(geometry, displacement),
                measuredHorizonPixels: measuredHorizonShift(model.ellipsoid, shifted, geometry),
                maximumColorErrorCodes: Math.max(...residual.map(Math.abs)), rmsColorErrorCodes: Math.sqrt(residual.reduce((sum, x) => sum + x * x, 0) / residual.length),
                referenceBuildGpuMs: build.gpuMs, wallMs: performance.now() - wallStart };
            samples.push(item); return { residual, item };
        } finally { fresh.dispose(); }
    };
    for (let axis = 0; axis < 3; axis++) {
        const pair = [];
        for (const sign of [-1, 1]) {
            const offset = [0, 0, 0]; offset[axis] = sign * Math.min(steps[axis], axis === 2 && sign < 0 ? h * 0.25 : Infinity);
            pair.push(await evaluate(offset, `Calibration ${['est', 'nord', 'altitude'][axis]} ${sign < 0 ? '-' : '+'}`));
        }
        const denominator = pair[1].item.localOffsetMeters[axis] - pair[0].item.localOffsetMeters[axis];
        const central = Math.max(...pair[0].residual.map((v, i) => Math.abs(pair[1].residual[i] - v) / denominator));
        const oneSided = Math.max(...pair.map(value => value.item.maximumColorErrorCodes / Math.abs(value.item.localOffsetMeters[axis])));
        calibrationResiduals.push(Math.max(central, oneSided));
    }
    const limits = axisReuseLimits(geometry, basis, calibrationResiduals, pixelBudget, codeBudget, range);
    const tests = [];
    for (const [i, weights] of [[0, [0.7, -0.2, 0.1]], [1, [-0.2, 0.6, -0.2]], [2, [0.2, 0.2, 0.6]]]) {
        const offset = weights.map((v, axis) => v * limits[axis].firstOrderLimitMeters);
        const value = await evaluate(offset, `Validation mixte ${i + 1}`);
        value.item.predictedColorErrorCodes = colorBudget(calibrationResiduals, offset);
        value.item.withinBudgets = value.item.maximumColorErrorCodes <= codeBudget && value.item.measuredHorizonPixels <= pixelBudget;
        tests.push(value.item);
    }
    const stereo = (await evaluate([0.064, 0, 0], 'Verification stereo : 64 mm')).item;
    const holdoutsPass = tests.every(value => value.withinBudgets), safetyFactor = holdoutsPass ? 0.5 : 0;
    return { origin: camera.origin, altitudeMeters: h, definition: [renderer.width, renderer.height], projectionHalfTangents: [camera.halfWidth, camera.halfHeight], exposure: renderer.exposure,
        sun: model.sun, skyView: [renderer.layout.width, renderer.layout.height], probes: rays.length, horizonSamples: geometry.points.length,
        budgets: { horizonPixels: pixelBudget, maximumDisplayCodeError: codeBudget }, calibrationStepsMeters: steps,
        photometricSensitivityCodesPerMeterENU: calibrationResiduals, limits: limits.map((value, i) => ({ axis: ['east', 'north', 'up'][i], ...value, recommendedMeters: value.firstOrderLimitMeters * safetyFactor })),
        safetyFactor, holdoutsPass, samples, stereo, wallMs: performance.now() - start,
        formulas: { geometry: 'max_k |J_horizon_k dot deltaECEF| <= horizonPixelBudget', color: 'sE*|deltaEast| + sN*|deltaNorth| + sH*|deltaUp| <= displayCodeBudget' },
        validity: 'Local first-order model for this origin, Sun, exposure, projection and LUT quality. Color residual uses horizon reprojection and a freshly rebuilt LUT at every test position. Holdouts are independent of the six calibration samples. No universal translation threshold is implied.' };
}
