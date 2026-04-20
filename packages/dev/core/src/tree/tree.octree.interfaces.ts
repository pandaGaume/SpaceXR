import { IBounded, IBounds } from "../geometry";
import { CartesianMode } from "../geodesy/geodesy.system";
import { Nullable } from "../types";
import { ICameraViewState } from "../camera";
import { Observable } from "../events";
import { ISpatialTreeNode } from "./tree.spatial.interfaces";

/**
 * Local reference frame attached to an octree cell.
 * The world frame is ECEF by default. A cell can override with a tangent ENU/NED
 * frame (origin in geodetic coords) or declare itself camera-relative.
 */
export interface IReferenceFrame {
    mode: CartesianMode | "Camera";
    /** Geodetic origin (lat, lon, alt) when mode is ENU or NED. Ignored for ECEF / Camera. */
    origin?: { lat: number; lon: number; alt?: number };
    /** Optional 4x4 row-major transform from local to world (ECEF). Falls back to origin-derived matrix. */
    localToWorld?: ReadonlyArray<number>;
}

export function IsReferenceFrame(b: unknown): b is IReferenceFrame {
    if (typeof b !== "object" || b === null) return false;
    return (<IReferenceFrame>b).mode !== undefined;
}

/**
 * Visibility decision produced by a policy for a single cell.
 * - cull: cell is not visible, skip entirely
 * - load: cell is visible and its own datasources should be considered for loading
 * - refine: cell is visible but too coarse, traverse children
 */
export type VisibilityDecision = { readonly kind: "cull" } | { readonly kind: "load"; readonly priority: number } | { readonly kind: "refine"; readonly priority?: number };

/**
 * Strategy that decides whether a cell must be culled, loaded or refined.
 * Generic on the stored item type so the policy can inspect cell contents when useful.
 */
export interface IVisibilityPolicy<T extends IBounds | IBounded> {
    evaluate(node: IOctreeNode<T>, camera: ICameraViewState): VisibilityDecision;
}

/**
 * Octree node. Extends the generic spatial tree node with:
 * - a local reference frame (ECEF by default, inherited from parent when undefined)
 * - a 3DTiles-style geometric error used by the default SSE visibility policy
 * - an optional visibility policy that overrides the one inherited from the tree
 */
export interface IOctreeNode<T extends IBounds | IBounded> extends ISpatialTreeNode<T> {
    referenceFrame?: IReferenceFrame;
    geometricError?: number;
    visibilityPolicy?: IVisibilityPolicy<T>;

    parent?: Nullable<IOctreeNode<T>>;
    readonly children?: Array<IOctreeNode<T>>;

    /** Walk up the parent chain until a defined reference frame is found. */
    resolveReferenceFrame(): IReferenceFrame | undefined;
    /** Walk up the parent chain until a defined visibility policy is found. */
    resolveVisibilityPolicy(): IVisibilityPolicy<T> | undefined;
}

export function IsOctreeNode<T extends IBounds | IBounded>(b: unknown): b is IOctreeNode<T> {
    if (typeof b !== "object" || b === null) return false;
    const n = b as IOctreeNode<T>;
    return n.resolveReferenceFrame !== undefined && n.resolveVisibilityPolicy !== undefined;
}

/**
 * Payload emitted by the updatedObservable when an item's bounds change.
 * `previousBounds` is the bounds the tree last knew about, used by consumers to
 * figure out which cells the item left (for visibility diffing).
 */
export interface IOctreeUpdate<T extends IBounds | IBounded> {
    readonly item: T;
    readonly previousBounds?: IBounds;
}

/**
 * Observable extension of an octree. Enables reactive scenarios like fleet monitoring
 * where items move between cells over time. Consumers (Engine / View) subscribe to the
 * three observables to keep their visibility state coherent.
 */
export interface IObservableOctree<T extends IBounds | IBounded> {
    readonly root: IOctreeNode<T>;
    readonly addedObservable: Observable<ReadonlyArray<T>>;
    readonly removedObservable: Observable<ReadonlyArray<T>>;
    readonly updatedObservable: Observable<ReadonlyArray<IOctreeUpdate<T>>>;

    /**
     * Re-home a single item whose bounds have changed. If `previousBounds` is provided,
     * the tree removes from the previous location precisely; otherwise a best-effort
     * remove is attempted with the current (new) bounds, which is only safe when the
     * item has not yet left its former cell.
     */
    update(item: T, previousBounds?: IBounds): void;

    /** Batched variant. Emits a single `updated` event for all items. */
    updateAll(updates: ReadonlyArray<IOctreeUpdate<T>>): void;
}
