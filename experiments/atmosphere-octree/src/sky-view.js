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

/** Horizontal optical field of view. Does not alter any celestial angular size. */
export function cameraWithHorizontalFov(camera, width, height, degrees) {
    cameraForDisplay(camera,width,height);
    if (!(Number.isFinite(degrees) && degrees >= 5 && degrees <= 120)) throw new Error('Invalid horizontal field of view');
    const halfWidth = Math.tan(degrees*Math.PI/360);
    return new FrustumCamera(camera.origin,camera.forward,camera.right,camera.up,halfWidth,halfWidth*height/width);
}
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Keep the Sun slightly below frame center while zooming; preserve the physical projection. */
export function cameraFramingSun(camera, sun) {
    const direction=normalize(sun);let right=cross(camera.up,direction);
    if(Math.hypot(...right)<1e-8) right=camera.right.map((v,i)=>v-dot(camera.right,direction)*direction[i]);
    right=normalize(right);const up=normalize(cross(direction,right));
    const angle=0.12*2*Math.atan(camera.halfHeight);
    const forward=direction.map((v,i)=>v*Math.cos(angle)+up[i]*Math.sin(angle));
    return new FrustumCamera(camera.origin,forward,right,cross(forward,right),camera.halfWidth,camera.halfHeight);
}
/** Exact angular-circle projection sampled on the physical solar limb, in native pixels. */
export function projectedSolarDisk(camera, sun, angularRadius, width, height) {
    if(!(angularRadius>0 && angularRadius<0.1)) throw new Error('Invalid solar angular radius');
    const s=normalize(sun),centerForward=dot(s,camera.forward);
    if(centerForward<=Math.sin(angularRadius)) return null;
    let tangent=cross(s,camera.up);
    if(Math.hypot(...tangent)<1e-8)tangent=cross(s,camera.right);
    tangent=normalize(tangent);const second=cross(s,tangent),xs=[],ys=[];
    for(let i=0;i<256;i++) {
        const angle=2*Math.PI*i/256;
        const d=s.map((v,c)=>v*Math.cos(angularRadius)+Math.sin(angularRadius)*(tangent[c]*Math.cos(angle)+second[c]*Math.sin(angle)));
        const z=dot(d,camera.forward);
        xs.push(width*.5*(1+dot(d,camera.right)/z/camera.halfWidth));
        ys.push(height*.5*(1-dot(d,camera.up)/z/camera.halfHeight));
    }
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    return {angularDiameterDegrees:angularRadius*360/Math.PI,widthPixels:x1-x0,heightPixels:y1-y0,centerPixels:[width*.5*(1+dot(s,camera.right)/centerForward/camera.halfWidth),height*.5*(1-dot(s,camera.up)/centerForward/camera.halfHeight)],boundsPixels:[x0,y0,x1,y1]};
}
