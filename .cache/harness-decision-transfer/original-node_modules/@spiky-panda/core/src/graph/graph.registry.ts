import { Observable } from "../events/events.observable";
import type { IRuntimeNode, IPortDescriptor } from "../execution/execution.interfaces";
import type { IOlink } from "./graph.interfaces";
import type { INodeSignature } from "./graph.signatures";

export interface INodeMeta {
    readonly type: string;
    readonly label: string;
    readonly category?: string;
    readonly inputPorts: ReadonlyArray<IPortDescriptor>;
    readonly outputPorts: ReadonlyArray<IPortDescriptor>;
    /**
     * What this node type can do, said for a planner: purpose, ports with
     * their quantity and unit, capability tags, measured cost. Declared by
     * the plugin next to the ports; `validateSignature` checks it agrees
     * with them. See graph.signatures.ts.
     */
    readonly signature?: INodeSignature;
    /** Optional control-plane ports the node exposes (default: _enable
     *  in / _enabled out via RuntimeNode; RunnableNode adds _start /
     *  _stop / _started / _stopped). The palette and editor read these
     *  to render control ports in a distinct row. */
    readonly controlInputPorts?: ReadonlyArray<IPortDescriptor>;
    readonly controlOutputPorts?: ReadonlyArray<IPortDescriptor>;
    /** Interop standards this node complies with (e.g. "onnx", "ue5").
     *  Each entry is either a bare id (the standards registry's default
     *  version is used) or `{ id, version }` to pin a specific version
     *  on this node. The property panel renders one GitHub-style shield
     *  per entry; validators iterate ids to decide whether a whole graph
     *  can be exported to a given target. Empty/absent = no interop
     *  guarantee. */
    readonly standards?: ReadonlyArray<string | { readonly id: string; readonly version?: string }>;
    /** Variadic input descriptor: when set, the editor maintains a
     *  growing/shrinking set of input ports `${prefix}0`, `${prefix}1`,
     *  ... so exactly one trailing unconnected port stays available
     *  (the "+" slot).
     *
     *  Accepts an ARRAY of descriptors when a node needs multiple
     *  parallel variadic groups on the same side (e.g. the Stem tile
     *  declares `[{ prefix: "f_" }, { prefix: "A_" }]` for paired
     *  frequency/amplitude inputs). Each group is reconciled
     *  independently by the editor. */
    readonly variadicInput?: { readonly prefix: string; readonly type: string } | ReadonlyArray<{ readonly prefix: string; readonly type: string }>;
    /** Same as `variadicInput` but for the output side (e.g. Sequence's
     *  `then_0`, `then_1`, ...). Also accepts the multi-group array
     *  form for symmetry, although no current node uses it. */
    readonly variadicOutput?: { readonly prefix: string; readonly type: string } | ReadonlyArray<{ readonly prefix: string; readonly type: string }>;
    /**
     * Non-exclusive capability tags: what this node type IS, for the
     * paths that only have the registration and no instance (a palette
     * grouping, a document builder, a headless job registry).
     *
     * A node can carry several, and they do not partition the catalogue:
     * a tile that also computes is both `"ui"` and `"compute"`. Unknown
     * tags are carried through untouched, so a plugin can declare its own
     * without a change here.
     *
     * PRECEDENCE: a tag is a declaration, not a truth. Wherever a live
     * instance exists, the instance decides, because it is the instance
     * that will have to do the work: a node tagged `"ui"` whose instance
     * does not implement `IRenderable` cannot be mounted, and no tag
     * makes it mountable. Tags answer only where there is nothing to ask.
     */
    readonly tags?: ReadonlyArray<string>;
    /**
     * Number of independent anchor widgets the editor should render
     * for this node. Default undefined / 1 → ordinary single-widget
     * node. Values >= 2 turn it into a split-view node: one logical
     * entity drawn as N independently-draggable widgets, with ports
     * routed to widgets via their `IPortDescriptor.anchor` field.
     * The runtime is unaffected — `anchorCount` is editor-only metadata.
     */
    readonly anchorCount?: number;
    /**
     * URL(s) to a Markdown document describing this node — purpose,
     * port semantics, parameter ranges, gotchas. The editor's
     * DocsViewer fetches and renders this whenever the user opens the
     * Docs tab on a node of this type.
     *
     * Two accepted shapes:
     *   - **Bare string**: a single URL, treated as the default-locale
     *     doc. Hosts may surface it without offering a language menu.
     *   - **Locale map** `Record<BCP47, string>`: e.g.
     *     `{ "en-US": ".../dynamic.en.md", "fr-FR": ".../dynamic.fr.md" }`.
     *     The viewer chooses the best match for the user's browser
     *     language (or their persisted preference), and renders a
     *     language selector when ≥ 2 entries are declared.
     *
     * URLs are opaque to the registry: the plugin author resolves them
     * however fits the deployment (typically `ctx.assetUrl("docs/...")`
     * to ship files inside the plugin bundle folder). Absent = no docs
     * available; the Docs tab renders an empty-state hint.
     *
     * Plugin vendors choose freely how many locales to ship — there is
     * no required minimum. The viewer falls back to en-US (then the
     * first available entry) when nothing matches the user's
     * preferences.
     */
    readonly docPath?: string | Readonly<Record<string, string>>;
}

/**
 * Resolve a `docPath` declaration against an ordered list of preferred
 * locales (BCP-47), returning the URL of the best-matching doc — or
 * `null` if none can be served.
 *
 * Matching order (first hit wins):
 *   1. Exact match against any preferred locale (case-insensitive).
 *   2. Prefix match: preferred `en-US` matches available `en`, and
 *      preferred `en` matches available `en-US` — the closest one wins.
 *   3. Fallback to `en-US` if present.
 *   4. Fallback to `en` if present.
 *   5. First entry in declaration order.
 *
 * Bare-string `docPath` always resolves to itself regardless of
 * preferences (it's the no-i18n case).
 */
export function resolveDocPath(docPath: string | Readonly<Record<string, string>> | undefined, preferred: ReadonlyArray<string>): string | null {
    if (!docPath) return null;
    if (typeof docPath === "string") return docPath;
    const entries = Object.keys(docPath);
    if (entries.length === 0) return null;
    const lower = new Map(entries.map((k) => [k.toLowerCase(), k]));
    for (const p of preferred) {
        const exact = lower.get(p.toLowerCase());
        if (exact) return docPath[exact];
    }
    for (const p of preferred) {
        const pl = p.toLowerCase();
        const head = pl.split("-")[0];
        for (const [keyLower, keyOriginal] of lower) {
            if (keyLower === head) return docPath[keyOriginal];
            if (keyLower.startsWith(head + "-")) return docPath[keyOriginal];
        }
    }
    const enUs = lower.get("en-us");
    if (enUs) return docPath[enUs];
    const en = lower.get("en");
    if (en) return docPath[en];
    return docPath[entries[0]];
}

/**
 * Return the list of locales declared in a docPath map, in the order
 * the plugin author wrote them. Bare-string docPath is treated as a
 * single anonymous entry — the caller decides how to label it.
 */
export function listDocLocales(docPath: string | Readonly<Record<string, string>> | undefined): ReadonlyArray<string> {
    if (!docPath) return [];
    if (typeof docPath === "string") return [];
    return Object.keys(docPath);
}

export type NodeFactory = (config?: Record<string, unknown>) => IRuntimeNode;

/** What changed in the catalogue, and how. */
export interface INodeRegistryChange {
    readonly type: string;
    readonly action: "registered" | "unregistered";
}

export interface INodeRegistry {
    register(type: string, factory: NodeFactory, meta: Omit<INodeMeta, "type">): void;
    unregister(type: string): boolean;
    create(type: string, config?: Record<string, unknown>): IRuntimeNode | undefined;
    meta(type: string): INodeMeta | undefined;
    types(): ReadonlyArray<string>;
    /**
     * Fired once per type added or removed.
     *
     * The catalogue is not fixed at boot. A plugin loaded while the editor is
     * running adds to it, and without a signal every view built from the
     * registry silently keeps showing the catalogue as it was: the node is
     * addressable by id and invisible in the palette, which is the wrong way
     * round for someone discovering a new domain.
     */
    readonly onChanged: Observable<INodeRegistryChange>;
}

export class NodeRegistry implements INodeRegistry {
    private readonly _factories = new Map<string, NodeFactory>();
    private readonly _meta = new Map<string, INodeMeta>();

    public readonly onChanged = new Observable<INodeRegistryChange>();

    public register(type: string, factory: NodeFactory, meta: Omit<INodeMeta, "type">): void {
        this._factories.set(type, factory);
        this._meta.set(type, { ...meta, type });
        this.onChanged.notifyObservers({ type, action: "registered" });
    }

    public unregister(type: string): boolean {
        this._meta.delete(type);
        const removed = this._factories.delete(type);
        // Silent when nothing was there: a listener should hear about changes,
        // not about attempts.
        if (removed) this.onChanged.notifyObservers({ type, action: "unregistered" });
        return removed;
    }

    public create(type: string, config?: Record<string, unknown>): IRuntimeNode | undefined {
        return this._factories.get(type)?.(config);
    }

    public meta(type: string): INodeMeta | undefined {
        return this._meta.get(type);
    }

    public types(): ReadonlyArray<string> {
        return Array.from(this._factories.keys());
    }
}

/**
 * Editor and runtime metadata for a concrete link type.
 *
 * `sourcePortTypes` and `targetPortTypes` are optional routing hints used
 * when a visual editor creates a cable without an explicitly selected link
 * type. An absent list accepts every port type. The literal `"*"` is also a
 * wildcard. Higher `priority` wins when several registered link types match;
 * equal priorities preserve registration order.
 */
export interface ILinkMeta {
    readonly type: string;
    readonly label: string;
    readonly category?: string;
    readonly sourcePortTypes?: ReadonlyArray<string>;
    readonly targetPortTypes?: ReadonlyArray<string>;
    readonly priority?: number;
}

/** Create an unwired link definition. Endpoints are assigned only when a
 * runtime graph is materialized. */
export type LinkFactory = (config?: Record<string, unknown>) => IOlink;

/** Registry counterpart of `INodeRegistry` for persisted graph links. */
export interface ILinkRegistry {
    register(type: string, factory: LinkFactory, meta: Omit<ILinkMeta, "type">): void;
    unregister(type: string): boolean;
    create(type: string, config?: Record<string, unknown>): IOlink | undefined;
    meta(type: string): ILinkMeta | undefined;
    types(): ReadonlyArray<string>;
    resolve(sourcePortType: string, targetPortType: string): string | undefined;
}

/**
 * Factory registry for concrete graph links.
 *
 * It deliberately creates links without endpoints. This keeps an editor's
 * persisted link definition separate from the short-lived link instance
 * attached to a `RuntimeGraph` and owned by a `Session` build.
 */
export class LinkRegistry implements ILinkRegistry {
    private readonly _factories = new Map<string, LinkFactory>();
    private readonly _meta = new Map<string, ILinkMeta>();

    public register(type: string, factory: LinkFactory, meta: Omit<ILinkMeta, "type">): void {
        this._factories.set(type, factory);
        this._meta.set(type, { ...meta, type });
    }

    public unregister(type: string): boolean {
        this._meta.delete(type);
        return this._factories.delete(type);
    }

    public create(type: string, config?: Record<string, unknown>): IOlink | undefined {
        return this._factories.get(type)?.(config);
    }

    public meta(type: string): ILinkMeta | undefined {
        return this._meta.get(type);
    }

    public types(): ReadonlyArray<string> {
        return Array.from(this._factories.keys());
    }

    public resolve(sourcePortType: string, targetPortType: string): string | undefined {
        let selected: string | undefined;
        let selectedPriority = -Infinity;
        for (const [type, meta] of this._meta) {
            if (!acceptsPortType(meta.sourcePortTypes, sourcePortType)) continue;
            if (!acceptsPortType(meta.targetPortTypes, targetPortType)) continue;
            const priority = meta.priority ?? 0;
            if (selected === undefined || priority > selectedPriority) {
                selected = type;
                selectedPriority = priority;
            }
        }
        return selected;
    }
}

function acceptsPortType(accepted: ReadonlyArray<string> | undefined, actual: string): boolean {
    return accepted === undefined || accepted.length === 0 || accepted.includes("*") || accepted.includes(actual);
}
