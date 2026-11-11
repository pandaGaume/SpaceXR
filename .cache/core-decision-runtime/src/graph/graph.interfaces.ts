import { IHasTransform, isCartesian } from "../geometry/geometry.interfaces";
import { IDisposable, Nullable } from "../types";

export type { IDisposable };

export const CloneMetadataKey = Symbol.for("spikypanda.cloneable");

/// <summary>
/// Marks a property as cloneable for automatic deep copying
/// </summary>
export function cloneable(target: object, propertyKey: string | symbol): void {
    const proto = target.constructor.prototype;
    const existingProps: string[] = Reflect.getMetadata(CloneMetadataKey, proto) || [];
    Reflect.defineMetadata(CloneMetadataKey, [...existingProps, propertyKey], proto);
}

/// <summary>
/// Interface for cloneable objects
/// </summary>
export interface ICloneable<T = any> {
    clone(): T;
}

/// <summary>
/// Type guard to check if an object implements ICloneable
/// </summary>
export function IsCloneable<T>(obj: unknown): obj is ICloneable<T> {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj as Partial<ICloneable<T>>;
    return typeof candidate.clone === "function";
}

export interface ITaggable {
    withTag(tag: string): ITaggable;
    tag?: string;
}

export interface IIDentifiable {
    id?: any;
}

/**
 * Ontology type tag on a graph item. A CONTROLLED semantic / ontology
 * category drawn from the core `ONTOLOGY` registry (see graph.ontology.ts) —
 * distinct from the free-form `tag`:
 *   - on an `IOlink` it names the RELATION kind (e.g. a binding relation:
 *     "scene" / "solver" / "atmosphere" / ... ; later "child" / "part");
 *   - on a node it names its ontological category.
 * Optional: `undefined` = untyped (the default; a plain data link or an
 * uncategorised node carries nothing). Editor-independent (lives in core),
 * and serialized by `GraphItem.serialize()` so it round-trips without the
 * node-editor's port-type inference.
 */
export interface ITyped {
    type?: string;
}

export interface IHasBag<T = unknown> {
    /**
     * Runtime-only container for execution context.
     * Can be safely overwritten between runs.
     */
    bag?: T;
}

/**
 * Toggleable runtime state. When enabled is false, the consumer (e.g.
 * the sim scheduler) treats the bearer as inert: skipped during
 * execution, ignored for dependency calculations. The bearer remains in
 * place so topology and identity are preserved.
 */
export interface IEnabled {
    enabled: boolean;
    /**
     * Opt-out flag for nodes whose `enabled` field is structurally
     * present (inherited from a base class) but semantically meaningless
     * to expose as a user-facing toggle. When `false`, editors omit the
     * enable checkbox / control row entry for this node. Absent or true
     * = the enable toggle is shown as usual. Lifecycle source nodes
     * (StartNode, StopNode) set this to false.
     */
    readonly supportsEnabling?: boolean;
}

/**
 * Type guard for IEnabled.
 */
export function isEnabled(obj: unknown): obj is IEnabled {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj as Partial<IEnabled>;
    return typeof candidate.enabled === "boolean";
}

/**
 * Returns true when the target wants the enable toggle exposed. The
 * default is true (absent or undefined `supportsEnabling` means yes);
 * explicit `false` is the opt-out for always-on nodes.
 */
export function supportsEnabling(target: object): boolean {
    return (target as Partial<IEnabled>).supportsEnabling !== false;
}

export interface IGraphItem<B = unknown> extends IDisposable, ICloneable, ITaggable, IIDentifiable, IHasBag<B>, ITyped {}

/**
 * A graph node. Extends `IHasTransform`, so every node carries the
 * founding geometric pose (`position` / `orientation` / `parent` +
 * `localTransform()` / `worldTransform()`); see `IHasTransform`. The
 * pose members are all optional, so a non-spatial node pays nothing.
 */
export interface INode<B = unknown> extends IGraphItem<B>, IHasTransform {
    onsc<L extends IOlink>(filter?: (link: IOlink) => boolean): Array<L>;
    opsc<L extends IOlink>(filter?: (link: IOlink) => boolean): Array<L>;
    add<L extends IOlink>(...links: Array<L>): void;
    remove<L extends IOlink>(...links: Array<L>): void;
}

// we define the INodeSet and ILinkSet interfaces to be able to use them to group nodes and links
// this is particularly useful when we want to perform operations on a group such Layers in Neural Networks
// or attach specific properties to a group of nodes or links.
export interface INodeSet<N extends INode> extends Array<N> {}

export interface IOlink<B = unknown> extends IGraphItem<B> {
    oini: Nullable<INode>;
    ofin: Nullable<INode>;
}

export interface ILinkSet<L extends IOlink> extends Array<L> {}

export interface IGraph<N extends INode, L extends IOlink> extends INode {
    nodes: INodeSet<N>;
    links: ILinkSet<L>;
    inputs: INodeSet<N>;
    outputs: INodeSet<N>;
    hiddens: INodeSet<N>;
}

/**
 * Type guard for INode
 */
export function isNode<N extends INode>(obj: unknown): obj is N {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj as Partial<INode>;
    return (candidate.position === undefined || isCartesian(candidate.position)) && typeof candidate.onsc === "function" && typeof candidate.opsc === "function";
}

/**
 * Type guard for IOlink
 */
export function isOlink<L extends IOlink>(obj: unknown): obj is L {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj as Partial<IOlink>;
    return isNode(candidate.oini) && isNode(candidate.ofin);
}

/**
 * Type guard for IGraph
 */
export function isGraph<N extends INode, L extends IOlink>(obj: unknown): obj is IGraph<N, L> {
    if (!isNode<N>(obj)) {
        return false;
    }
    const candidate = obj as N & Partial<IGraph<N, L>>;
    return (
        Array.isArray(candidate.nodes) &&
        Array.isArray(candidate.links) &&
        Array.isArray(candidate.inputs) &&
        Array.isArray(candidate.outputs) &&
        candidate.nodes.every(isNode) &&
        candidate.links.every(isOlink) &&
        candidate.inputs.every(isNode) &&
        candidate.outputs.every(isNode)
    );
}
