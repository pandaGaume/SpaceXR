import { IBounded, IBounds } from "../geometry";
import { ICameraViewState } from "../camera";
import { IOctreeNode, IVisibilityPolicy, VisibilityDecision } from "../tree/tree.octree.interfaces";

export interface ISSEOptions {
    /**
     * Maximum screen-space error (in pixels) tolerated before refining.
     * Below this value the cell is considered accurate enough and loads its own datasources.
     * Above this value the cell is refined (children are traversed).
     */
    maxScreenSpaceError: number;
    /**
     * Fallback viewport height (pixels) when the camera state does not carry one.
     * Default: 1080.
     */
    defaultViewportHeight: number;
    /**
     * Fallback near plane when camera state does not carry one. Default: 0.1.
     */
    defaultNear: number;
    /**
     * Fallback far plane when camera state does not carry one. Default: 1e9.
     */
    defaultFar: number;
}

/**
 * Default 3DTiles-style visibility policy.
 *
 * For each cell:
 *  - compute the distance from the camera to the cell bounding box center (world frame)
 *  - project the cell's geometric error onto the screen (pixel units)
 *  - if projected error <= maxScreenSpaceError : load this cell
 *  - else : refine (traverse children)
 *
 * Projection (standard pinhole, vertical FOV):
 *   sse = (geometricError * viewportHeight) / (distance * 2 * tan(fovY / 2))
 *
 * Cells without a geometricError always load (leaf semantics).
 * Frustum plane culling is used when the camera state carries `frustumPlanes`.
 */
export class ScreenSpaceErrorPolicy<T extends IBounds | IBounded> implements IVisibilityPolicy<T> {
    public static readonly DefaultMaxScreenSpaceError = 16;

    public readonly options: ISSEOptions;

    public constructor(options?: Partial<ISSEOptions>) {
        this.options = {
            maxScreenSpaceError: options?.maxScreenSpaceError ?? ScreenSpaceErrorPolicy.DefaultMaxScreenSpaceError,
            defaultViewportHeight: options?.defaultViewportHeight ?? 1080,
            defaultNear: options?.defaultNear ?? 0.1,
            defaultFar: options?.defaultFar ?? 1e9,
        };
    }

    public evaluate(node: IOctreeNode<T>, camera: ICameraViewState): VisibilityDecision {
        const box = node.boundingBox;
        if (!box) {
            return { kind: "cull" };
        }

        const cx = box.center.x - camera.worldPosition.x;
        const cy = box.center.y - camera.worldPosition.y;
        const cz = box.center.z - camera.worldPosition.z;
        const distance = Math.hypot(cx, cy, cz);

        const near = camera.near ?? this.options.defaultNear;
        const far = camera.far ?? this.options.defaultFar;
        const radius = Math.max(box.extendSize.x, box.extendSize.y, box.extendSize.z);

        if (distance - radius > far || distance + radius < near) {
            return { kind: "cull" };
        }

        if (camera.isInFrustum) {
            if (!camera.isInFrustum(box)) {
                return { kind: "cull" };
            }
        } else if (camera.frustumPlanes && camera.frustumPlanes.length > 0) {
            for (const plane of camera.frustumPlanes) {
                const d = plane.normal.x * box.center.x + plane.normal.y * box.center.y + plane.normal.z * box.center.z + plane.d;
                if (d < -radius) {
                    return { kind: "cull" };
                }
            }
        }

        const ge = node.geometricError;
        if (ge === undefined || ge <= 0) {
            return { kind: "load", priority: 1 / Math.max(distance, 1e-6) };
        }

        const tan = camera.tanFov2 > 0 ? camera.tanFov2 : Math.tan((camera.fovY || 0) * 0.5);
        const viewportHeight = camera.viewportHeight ?? this.options.defaultViewportHeight;
        const denom = 2 * tan * Math.max(distance, 1e-6);
        const sse = denom > 0 ? (ge * viewportHeight) / denom : Infinity;

        const priority = sse;
        if (sse <= this.options.maxScreenSpaceError || !node.children || node.children.length === 0) {
            return { kind: "load", priority };
        }
        return { kind: "refine", priority };
    }
}
