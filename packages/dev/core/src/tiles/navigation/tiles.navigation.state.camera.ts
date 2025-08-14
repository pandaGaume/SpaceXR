import { Observable, PropertyChangedEventArgs } from "../../events";
import { Cartesian3, ICartesian3, IPlane } from "../../geometry";
import { Nullable } from "../../types";
import { ICameraViewState, IFrustumValues } from "./tiles.navigation.interfaces";

/// <summary>
/// Concrete ICameraState with change notifications, cached frustum planes,
/// and settable frustum parameters (aspect, near, far, up).
/// </summary>
export class CameraState implements ICameraViewState {
    public static readonly DefaultScale = 1.0;
    public static readonly DefaultAspect = 16 / 9;
    public static readonly DefaultNear = 0.1;
    public static readonly DefaultFar = 10_000;
    public static readonly DefaultUp = new Cartesian3(0, 1, 0);

    public static readonly POSITION_PROPERTY_NAME = "position";
    public static readonly TARGET_PROPERTY_NAME = "target";
    public static readonly FOV_PROPERTY_NAME = "fov";
    public static readonly SCALE_PROPERTY_NAME = "scale";
    public static readonly ASPECT_PROPERTY_NAME = "aspect";
    public static readonly NEAR_PROPERTY_NAME = "near";
    public static readonly FAR_PROPERTY_NAME = "far";
    public static readonly UP_PROPERTY_NAME = "up";

    private _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ICameraViewState, unknown>>;

    private _position: ICartesian3;
    private _target: ICartesian3;
    private _fovY: number; // degrees
    private _tanfov2?: number; // cache
    private _scale: number;

    private _aspect: number = CameraState.DefaultAspect;
    private _near: number = CameraState.DefaultNear;
    private _far: number = CameraState.DefaultFar;
    private _up: ICartesian3 = CameraState.DefaultUp;

    private _planes: Nullable<Array<IPlane>> = null;

    constructor(position: ICartesian3, target: ICartesian3, fovDeg: number, scale?: number) {
        this._position = position;
        this._target = target;
        this._fovY = fovDeg;
        this._scale = scale ?? CameraState.DefaultScale;
    }

    /// <summary>Observable for property change notifications.</summary>
    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ICameraViewState, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ICameraViewState, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    // ---------------- Core camera props ----------------

    /// <summary>Camera position.</summary>
    get position(): ICartesian3 {
        return this._position;
    }
    set position(value: ICartesian3) {
        if (this._position !== value) {
            const old = this._position;
            this._position = value;
            this.invalidateFrustum();
            this.notifyChange(old, value, CameraState.POSITION_PROPERTY_NAME);
        }
    }

    /// <summary>Camera target.</summary>
    get target(): ICartesian3 {
        return this._target;
    }
    set target(value: ICartesian3) {
        if (this._target !== value) {
            const old = this._target;
            this._target = value;
            this.invalidateFrustum();
            this.notifyChange(old, value, CameraState.TARGET_PROPERTY_NAME);
        }
    }

    /// <summary>Field of view in degrees.</summary>
    get fovY(): number {
        return this._fovY;
    }
    set fovY(value: number) {
        if (this._fovY !== value) {
            const old = this._fovY;
            this._fovY = value;
            this._tanfov2 = undefined;
            this.invalidateFrustum();
            this.notifyChange(old, value, CameraState.FOV_PROPERTY_NAME);
        }
    }

    /// <summary>tan(FOV/2) in radians (lazy-computed from `fovY`).</summary>
    get tanfov2(): number {
        if (this._tanfov2 === undefined) {
            this._tanfov2 = Math.tan(this._fovY / 2);
        }
        return this._tanfov2;
    }

    /// <summary>Scale (free param).</summary>
    get scale(): number {
        return this._scale;
    }
    set scale(value: number) {
        if (this._scale !== value) {
            const old = this._scale;
            this._scale = value;
            // scale may or may not affect frustum; keep cache if it doesn't in your pipeline.
            this.notifyChange(old, value, CameraState.SCALE_PROPERTY_NAME);
        }
    }

    // ---------------- Frustum params (settable) ----------------

    /// <summary>Viewport aspect ratio (width/height).</summary>
    get aspect(): number {
        return this._aspect;
    }
    set aspect(value: number) {
        if (this._aspect !== value) {
            const old = this._aspect;
            this._aspect = value;
            this.invalidateFrustum();
            this.notifyChange(old, value, CameraState.ASPECT_PROPERTY_NAME);
        }
    }

    /// <summary>Near clip distance (&gt; 0).</summary>
    get near(): number {
        return this._near;
    }
    set near(value: number) {
        if (this._near !== value) {
            const old = this._near;
            this._near = value;
            this.invalidateFrustum();
            this.notifyChange(old, value, CameraState.NEAR_PROPERTY_NAME);
        }
    }

    /// <summary>Far clip distance (&gt; near).</summary>
    get far(): number {
        return this._far;
    }
    set far(value: number) {
        if (this._far !== value) {
            const old = this._far;
            this._far = value;
            this.invalidateFrustum();
            this.notifyChange(old, value, CameraState.FAR_PROPERTY_NAME);
        }
    }

    /// <summary>World up vector.</summary>
    get up(): ICartesian3 {
        return this._up;
    }
    set up(value: ICartesian3) {
        if (this._up !== value) {
            const old = this._up;
            this._up = value;
            this.invalidateFrustum();
            this.notifyChange(old, value, CameraState.UP_PROPERTY_NAME);
        }
    }

    // ---------------- API ----------------

    /// <summary>Returns cached frustum planes or rebuilds them from the current state.</summary>
    getFrustumPlanes(): Array<IPlane> {
        if (this._planes == null) {
            this._planes = this._buildFrustumPlanesFromCameraState(this, this);
        }
        return this._planes;
    }

    // ---------------- Internals ----------------

    private invalidateFrustum(): void {
        this._planes = null;
    }

    private notifyChange<T>(oldValue: T, newValue: T, name: string): void {
        if (this._propertyChangedObservable?.hasObservers()) {
            const e = new PropertyChangedEventArgs<ICameraViewState, T>(this, oldValue, newValue, name);
            this._propertyChangedObservable.notifyObservers(e, -1, this, this);
        }
    }

    private _buildFrustumPlanesFromCameraState(cam: ICameraViewState, opts: IFrustumValues = {}): IPlane[] {
        // --- defaults
        const aspect = opts.aspect ?? 16 / 9;
        const near = opts.near ?? 0.1;
        const far = opts.far ?? 10_000;
        const upGuess = opts.up ?? { x: 0, y: 1, z: 0 };

        // --- vec helpers
        const sub = (a: ICartesian3, b: ICartesian3): ICartesian3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
        const add = (a: ICartesian3, b: ICartesian3): ICartesian3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
        const mul = (a: ICartesian3, s: number): ICartesian3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
        const dot = (a: ICartesian3, b: ICartesian3): number => a.x * b.x + a.y * b.y + a.z * b.z;
        const cross = (a: ICartesian3, b: ICartesian3): ICartesian3 => ({
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x,
        });
        const len = (v: ICartesian3): number => Math.hypot(v.x, v.y, v.z);
        const norm = (v: ICartesian3): ICartesian3 => {
            const l = len(v) || 1;
            return { x: v.x / l, y: v.y / l, z: v.z / l };
        };

        // --- camera basis
        const pos = cam.position;
        const fwd = norm(sub(cam.target, cam.position)); // forward (view) direction
        const right = norm(cross(fwd, norm(upGuess))); // camera right
        const up = norm(cross(right, fwd)); // orthonormal up (roll resolved)

        // --- frustum dimensions
        const tanHalfV = cam.tanfov2; // vertical tan(FOV/2)
        const tanHalfH = tanHalfV * aspect; // horizontal tan(FOV/2)
        const nearC = add(pos, mul(fwd, near)); // near center
        const farC = add(pos, mul(fwd, far)); // far center

        const nh = near * tanHalfV; // near half-height
        const nw = near * tanHalfH; // near half-width
        const fh = far * tanHalfV; // far half-height
        const fw = far * tanHalfH; // far half-width

        // --- frustum corners (near & far)
        const ntl = add(add(nearC, mul(up, nh)), mul(right, -nw));
        const ntr = add(add(nearC, mul(up, nh)), mul(right, nw));
        const nbl = add(add(nearC, mul(up, -nh)), mul(right, -nw));
        const nbr = add(add(nearC, mul(up, -nh)), mul(right, nw));

        const ftl = add(add(farC, mul(up, fh)), mul(right, -fw));
        const ftr = add(add(farC, mul(up, fh)), mul(right, fw));
        const fbl = add(add(farC, mul(up, -fh)), mul(right, -fw));
        const fbr = add(add(farC, mul(up, -fh)), mul(right, fw));

        // --- plane helper: from 3 points (counter-clockwise as seen from INSIDE)
        const planeFromCCW = (a: ICartesian3, b: ICartesian3, c: ICartesian3): IPlane => {
            const n = norm(cross(sub(b, a), sub(c, a)));
            const d = -dot(n, a);
            return { normal: n, d };
        };

        // We prefer to **guarantee** normals face inward:
        // After building each plane, if it doesn't classify the frustum center as inside, flip it.
        const ensureInward = (p: IPlane): IPlane => {
            const insideProbe = add(pos, mul(fwd, (near + far) * 0.5)); // a point well inside
            const side = dot(p.normal, insideProbe) + p.d;
            return side >= 0 ? p : { normal: mul(p.normal, -1), d: -p.d };
        };

        // Near: CCW seen from inside -> (ntr, ntl, nbl) or (ntl, ntr, nbr) etc.
        const nearP = ensureInward(planeFromCCW(ntr, ntl, nbl));
        // Far:  CCW seen from inside (looking back) -> (ftl, ftr, fbr)
        const farP = ensureInward(planeFromCCW(ftl, ftr, fbr));
        // Left: CCW inside -> (ntl, ftl, fbl)
        const leftP = ensureInward(planeFromCCW(ntl, ftl, fbl));
        // Right: CCW inside -> (ftr, ntr, nbr)
        const rightP = ensureInward(planeFromCCW(ftr, ntr, nbr));
        // Top: CCW inside -> (ntr, ftr, ftl)
        const topP = ensureInward(planeFromCCW(ntr, ftr, ftl));
        // Bottom: CCW inside -> (fbl, fbr, nbr)
        const botP = ensureInward(planeFromCCW(fbl, fbr, nbr));

        return [leftP, rightP, topP, botP, nearP, farP];
    }
}
