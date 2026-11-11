/**
 * Ontology registry — the controlled vocabulary of graph-item `type`s
 * (see `ITyped` in graph.interfaces.ts).
 *
 * Lives in CORE so links and nodes can be TYPED independently of the
 * node-editor: the editor only RENDERS (dashed config cables, colors); the
 * vocabulary and its semantics are here. A `type` string stored on an
 * `IGraphItem` is a key into this registry.
 *
 * A descriptor carries:
 *   - `id`               : the stable string key stored in `IGraphItem.type`
 *                          and persisted by `serialize()`.
 *   - `superType`        : optional parent in the ontology, so relation kinds
 *                          can generalise (e.g. a future `part` / `child`
 *                          under a common `structural` super-type); `isA`
 *                          walks the chain.
 *   - `isBindingRelation`: true for the config-link family (`scene` /
 *                          `solver` / `atmosphere` / `shared` / ...): reference
 *                          handoffs resolved at session bind, NOT data flow,
 *                          rendered dashed. The editor's `isConfigLinkType`
 *                          consults this. Structural relations (`child` /
 *                          `part`, when added) are a SEPARATE category and are
 *                          NOT binding relations.
 *
 * Cross-bundle singleton via `Symbol.for` (same rationale as
 * `SOLVER_REGISTRY`): the node-editor inlines core through a webpack alias, so
 * without the pinch the editor and the plugins would consult two distinct
 * empty registries.
 */
export interface ITypeDescriptor {
    readonly id: string;
    readonly superType?: string;
    readonly isBindingRelation?: boolean;
}

class Ontology {
    private readonly _types: Map<string, ITypeDescriptor> = new Map();

    /** Register (or overwrite) a type descriptor. Idempotent for identical
     *  descriptors; plugins call this at activate() to extend the vocabulary. */
    public register(d: ITypeDescriptor): void {
        this._types.set(d.id, d);
    }

    public get(id: string): ITypeDescriptor | undefined {
        return this._types.get(id);
    }

    public has(id: string): boolean {
        return this._types.has(id);
    }

    /** True when `id` is a binding-relation type (the config-link family). */
    public isBindingRelation(id: string | undefined): boolean {
        return id !== undefined && this._types.get(id)?.isBindingRelation === true;
    }

    /** True when `id` equals `superId` or transitively descends from it via
     *  `superType`. Cycle-guarded. Lets `part` / `child` generalise under a
     *  common super-type once those are registered. */
    public isA(id: string | undefined, superId: string): boolean {
        let cur = id;
        const seen = new Set<string>();
        while (cur !== undefined && !seen.has(cur)) {
            if (cur === superId) return true;
            seen.add(cur);
            cur = this._types.get(cur)?.superType;
        }
        return false;
    }

    /** All registered binding-relation ids (the config-link family). */
    public bindingRelationIds(): string[] {
        const out: string[] = [];
        for (const d of this._types.values()) {
            if (d.isBindingRelation) out.push(d.id);
        }
        return out;
    }
}

const GLOBAL_ONTOLOGY_KEY = Symbol.for("spikypanda.ontology");
type GlobalSlot = { [k: symbol]: Ontology | undefined };
const __globalSlot = globalThis as unknown as GlobalSlot;
if (!__globalSlot[GLOBAL_ONTOLOGY_KEY]) {
    __globalSlot[GLOBAL_ONTOLOGY_KEY] = new Ontology();
}

/** The process-wide ontology registry. */
export const ONTOLOGY: Ontology = __globalSlot[GLOBAL_ONTOLOGY_KEY] as Ontology;

/**
 * Seed the CORE binding-relation types (the config-link family rooted in
 * core/sim: `scene` / `solver` / `atmosphere` / `shared` anchors). Idempotent.
 * Domain-specific relation types (`gas` / `composition` / `particulate` /
 * `layer`) belong to their plugins and should be registered there at
 * activate(); until then the node-editor's `isConfigLinkType` keeps its own
 * fallback set for them.
 */
for (const id of ["scene", "solver", "atmosphere", "shared"]) {
    if (!ONTOLOGY.has(id)) ONTOLOGY.register({ id, isBindingRelation: true });
}

// Structural relations: the generic graph hierarchy. NOT binding relations
// (never config cables, skipped by the per-slot routing cache). `child` backs
// the `Child` link class; `IHasTransform.parent` and scene-context resolution
// both consume it. `part` reserved for composition (registered when used).
if (!ONTOLOGY.has("child")) ONTOLOGY.register({ id: "child" });

// `applyTo`: a fault / operator (oini) APPLIES its physics to a target model
// (ofin), reading the target's PROPERTIES directly. Backs the `ApplyTo` link
// class. Structural, not a binding relation, not a data channel.
if (!ONTOLOGY.has("applyTo")) ONTOLOGY.register({ id: "applyTo" });
