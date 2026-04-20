import { ICameraViewState } from "../camera";
import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { IBounded, IBounds, ICartesian3 } from "../geometry";
import { IOctreeNode, IVisibilityPolicy, VisibilityDecision } from "../tree/tree.octree.interfaces";
import { IScreenSpaceErrorBudget, ResolveSSEBudget } from "./streaming.visibility.budget";

/**
 * User-supplied SSE function, letting callers override the default perspective
 * formula with custom physics (log scale, resolution-aware weighting, etc.).
 */
export type ScreenSpaceErrorFn = (geometricError: number, distanceToCamera: number, viewportHeight: number, tanFov2: number) => number;

/**
 * Default SSE : standard perspective projection of geometric error on the image plane.
 *   sse = (geometricError * viewportHeight) / (distance * 2 * tan(fov/2))
 */
export const DefaultScreenSpaceErrorFn: ScreenSpaceErrorFn = (geometricError, distance, viewportHeight, tanFov2) =>
    (geometricError * viewportHeight) / (Math.max(distance, 1e-6) * 2 * Math.max(tanFov2, 1e-6));

export type MapOverflightMode = "plane" | "sphere";

export interface IMapOverflightVisibilityPolicyOptions {
    /** Which surface model the camera is flying over. */
    mode: MapOverflightMode;

    /** SSE budget. A plain number is wrapped as ConstantSSEBudget. */
    budget: IScreenSpaceErrorBudget | number;

    // ── plane mode ──
    /** A point on the map plane. Default (0, 0, 0). */
    planePoint?: ICartesian3;
    /** Map plane normal. Default (0, 0, 1) = Z-up. Normalised at construction. */
    planeNormal?: ICartesian3;

    // ── sphere mode ──
    /** Any core/geodesy Ellipsoid (Earth, Moon, Mars, …). Sets sphereRadius from its semi-major axis. */
    ellipsoid?: Ellipsoid;
    /** Sphere center in world space. Default (0, 0, 0). */
    sphereCenter?: ICartesian3;
    /** Sphere radius in world units. Ignored when `ellipsoid` is provided. Default WGS84 radius. */
    sphereRadius?: number;
    /** Enable horizon-occlusion culling. Default true in sphere mode. */
    horizonCull?: boolean;

    // ── hysteresis (prevents popping near the threshold) ──
    /** Fixed hysteresis margin in pixels. Takes precedence over `hysteresisPercent` when both are set. */
    hysteresisOffset?: number;
    /** Hysteresis as a fraction of the current altitude-budget (0..1). */
    hysteresisPercent?: number;

    // ── overrides ──
    /** Custom SSE function. Default: standard perspective formula. */
    sseFn?: ScreenSpaceErrorFn;
    /** Fallback viewport height (pixels) when the camera state does not carry one. Default 1080. */
    defaultViewportHeight?: number;
}

/**
 * Visibility policy tailored for the "camera overflight" case : the map is
 * either a flat plane or a sphere (any planet via Ellipsoid), and the decision
 * whether to load or refine a cell depends on
 *  - frustum culling (via `camera.isInFrustum` when provided),
 *  - horizon culling when flying over a sphere,
 *  - altitude-dependent max screen-space error (via IScreenSpaceErrorBudget),
 *  - hysteresis around the budget to prevent flicker.
 *
 * Stateful : keeps the last decision per node in a WeakMap so the hysteresis
 * can kick in. Safe to reuse across engines and views.
 */
export class MapOverflightVisibilityPolicy<T extends IBounds | IBounded> implements IVisibilityPolicy<T> {
    public static readonly DefaultViewportHeight = 1080;

    private readonly _mode: MapOverflightMode;
    private readonly _budget: IScreenSpaceErrorBudget;

    private readonly _planePoint: ICartesian3;
    private readonly _planeNormal: ICartesian3;

    private readonly _sphereCenter: ICartesian3;
    private readonly _sphereRadius: number;
    private readonly _horizonCull: boolean;

    private readonly _hysteresisOffset?: number;
    private readonly _hysteresisPercent?: number;
    private readonly _sseFn: ScreenSpaceErrorFn;
    private readonly _defaultVH: number;

    private readonly _lastDecision = new WeakMap<IOctreeNode<T>, "load" | "refine">();

    public constructor(options: IMapOverflightVisibilityPolicyOptions) {
        this._mode = options.mode;
        this._budget = ResolveSSEBudget(options.budget);

        this._planePoint = options.planePoint ?? { x: 0, y: 0, z: 0 };
        const n = options.planeNormal ?? { x: 0, y: 0, z: 1 };
        const nl = Math.hypot(n.x, n.y, n.z) || 1;
        this._planeNormal = { x: n.x / nl, y: n.y / nl, z: n.z / nl };

        this._sphereCenter = options.sphereCenter ?? { x: 0, y: 0, z: 0 };
        this._sphereRadius = options.ellipsoid ? options.ellipsoid.semiMajorAxis : options.sphereRadius ?? 6378137;
        this._horizonCull = options.horizonCull ?? options.mode === "sphere";

        this._hysteresisOffset = options.hysteresisOffset;
        this._hysteresisPercent = options.hysteresisPercent;
        this._sseFn = options.sseFn ?? DefaultScreenSpaceErrorFn;
        this._defaultVH = options.defaultViewportHeight ?? MapOverflightVisibilityPolicy.DefaultViewportHeight;
    }

    public evaluate(node: IOctreeNode<T>, camera: ICameraViewState): VisibilityDecision {
        const bounds = node.boundingBox;
        if (!bounds) return { kind: "cull" };

        // Frustum
        if (camera.isInFrustum && !camera.isInFrustum(bounds)) return { kind: "cull" };

        // Horizon (sphere mode only)
        if (this._mode === "sphere" && this._horizonCull) {
            if (IsBeyondHorizon(bounds.center, camera.worldPosition, this._sphereCenter, this._sphereRadius)) {
                return { kind: "cull" };
            }
        }

        // Altitude for the budget
        const altitude = this._altitude(camera.worldPosition);

        // Distance to closest point on the AABB
        const distance = ClosestDistanceToAABB(camera.worldPosition, bounds);

        const gErr = node.geometricError;
        if (gErr === undefined || gErr <= 0) {
            // no geometric error : keep the cell as load (leaf-like semantics)
            this._lastDecision.set(node, "load");
            return { kind: "load", priority: 1 / Math.max(distance, 1e-6) };
        }

        const vh = camera.viewportHeight && camera.viewportHeight > 0 ? camera.viewportHeight : this._defaultVH;
        const tan = camera.tanFov2 > 0 ? camera.tanFov2 : Math.tan((camera.fovY || 0) * 0.5);
        const sse = this._sseFn(gErr, distance, vh, tan);

        const budgetMax = this._budget.getMaxSSE(altitude);

        // Hysteresis : asymmetric threshold depending on the previous decision.
        let effectiveMax = budgetMax;
        const hys = this._hysteresisAmount(budgetMax);
        if (hys > 0) {
            const prev = this._lastDecision.get(node);
            if (prev === "load") {
                effectiveMax = budgetMax + hys;
            } else if (prev === "refine") {
                effectiveMax = budgetMax - hys;
            }
        }

        const noChildren = !node.children || node.children.length === 0;
        if (sse <= effectiveMax || noChildren) {
            this._lastDecision.set(node, "load");
            return { kind: "load", priority: sse };
        }
        this._lastDecision.set(node, "refine");
        return { kind: "refine", priority: sse };
    }

    /** Camera altitude above the map surface (>=0 in sphere mode, signed in plane mode). */
    private _altitude(position: ICartesian3): number {
        if (this._mode === "plane") {
            const dx = position.x - this._planePoint.x;
            const dy = position.y - this._planePoint.y;
            const dz = position.z - this._planePoint.z;
            return dx * this._planeNormal.x + dy * this._planeNormal.y + dz * this._planeNormal.z;
        }
        const dx = position.x - this._sphereCenter.x;
        const dy = position.y - this._sphereCenter.y;
        const dz = position.z - this._sphereCenter.z;
        return Math.max(Math.hypot(dx, dy, dz) - this._sphereRadius, 0);
    }

    private _hysteresisAmount(budgetMax: number): number {
        if (this._hysteresisOffset !== undefined) return this._hysteresisOffset;
        if (this._hysteresisPercent !== undefined) return budgetMax * this._hysteresisPercent;
        return 0;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Shared math helpers (exported for reuse by other policies / sub-engines).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Closest distance from `point` to the axis-aligned bounding box. Returns 0
 * when the point is inside the box.
 */
export function ClosestDistanceToAABB(point: ICartesian3, bounds: IBounds): number {
    const cx = point.x < bounds.minimum.x ? bounds.minimum.x : point.x > bounds.maximum.x ? bounds.maximum.x : point.x;
    const cy = point.y < bounds.minimum.y ? bounds.minimum.y : point.y > bounds.maximum.y ? bounds.maximum.y : point.y;
    const cz = point.z < bounds.minimum.z ? bounds.minimum.z : point.z > bounds.maximum.z ? bounds.maximum.z : point.z;
    return Math.hypot(point.x - cx, point.y - cy, point.z - cz);
}

/**
 * True when `point` is occluded by the sphere as seen from `cameraPosition`.
 *
 * Uses the horizon-plane test :
 *   dot(point - center, cameraPos - center) < R²
 * which is exact for points on the sphere surface and mildly over-culls for
 * points well above the surface (acceptable for tile-pyramid cells). Cheap :
 * one dot product and one comparison.
 */
export function IsBeyondHorizon(point: ICartesian3, cameraPosition: ICartesian3, sphereCenter: ICartesian3, sphereRadius: number): boolean {
    const ux = cameraPosition.x - sphereCenter.x;
    const uy = cameraPosition.y - sphereCenter.y;
    const uz = cameraPosition.z - sphereCenter.z;
    const vx = point.x - sphereCenter.x;
    const vy = point.y - sphereCenter.y;
    const vz = point.z - sphereCenter.z;
    return ux * vx + uy * vy + uz * vz < sphereRadius * sphereRadius;
}
