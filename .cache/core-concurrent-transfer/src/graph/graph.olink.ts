import { Nullable } from "../types";
import { GraphItem } from "./graph.graphItem";
import { INode, IOlink } from "./graph.interfaces";

export class GraphOLink<B = unknown> extends GraphItem<B> implements IOlink<B> {
    private _oini: Nullable<INode> = null;
    public _ofin: Nullable<INode> = null;

    public constructor(oini?: INode, ofin?: INode) {
        super();
        this.oini = oini ?? null;
        this.ofin = ofin ?? null;
    }

    public get oini(): Nullable<INode> {
        return this._oini;
    }

    public set oini(n: Nullable<INode>) {
        if (this._oini !== n) {
            this._oini?.remove(this);
            this._oini = n;
            this._oini?.add(this);
        }
    }

    public get ofin(): Nullable<INode> {
        return this._ofin;
    }

    public set ofin(n: Nullable<INode>) {
        if (this._ofin !== n) {
            this._ofin?.remove(this);
            this._ofin = n;
            this._ofin?.add(this);
        }
    }

    public dispose(): void {
        this._oini?.remove(this);
        this._ofin?.remove(this);
        super.dispose();
    }
}

/**
 * Ontology ids of the structural relations, and the predicates that recognise
 * them.
 *
 * These exist because `instanceof` is not safe here. A page can hold more than
 * one copy of this module: the node editor bundles core inline, while the
 * plugins externalise it to a global, so a link built on one side is an
 * instance of a class the other side has never seen. The endpoints are right,
 * the ontology id is right, and `instanceof` is false.
 *
 * That failure is silent, which is what makes it expensive. A fault link built
 * by the editor was attached to the correct nodes, carried `type === "applyTo"`,
 * and was skipped by the model's filter, so the montage ran with every fault
 * inert and no error anywhere: a motor turning at its no-load speed looks
 * perfectly healthy.
 *
 * The `type` field is already the ontology id and is set by every constructor,
 * so testing it is both the cheaper check and the correct one. Copies of the
 * class are irrelevant; agreement on the vocabulary is what matters.
 */
export const CHILD_LINK_TYPE = "child";
export const APPLY_TO_LINK_TYPE = "applyTo";

/** True for a parent/child structural relation, whichever copy of core built it. */
export function isChildRelation(link: IOlink | null | undefined): boolean {
    return !!link && link.type === CHILD_LINK_TYPE;
}

/** True for a fault-application relation, whichever copy of core built it. */
export function isApplyToRelation(link: IOlink | null | undefined): boolean {
    return !!link && link.type === APPLY_TO_LINK_TYPE;
}

/**
 * `Child` relation: a STRUCTURAL link (not a dataflow channel) expressing the
 * generic 1/N parent -> child hierarchy. Directed parent (`oini`) -> child
 * (`ofin`), so the SAME link surfaces both directions through the node
 * adjacency: a node's `onsc` filtered to `Child` gives its children (N), its
 * `opsc` filtered to `Child` gives its parent (1).
 *
 * It carries no port / payload; its `type` is the ontology id "child"
 * (`isBindingRelation: false`, so it never renders as a config cable and is
 * skipped by the per-slot routing cache). `IHasTransform.parent` is DERIVED
 * (lazily cached) from the incoming `Child` link: the 3D transform tree is one
 * consumer of this generic graph relation, scene-context resolution another.
 * Idiomatic alongside the typed link subclasses already in the codebase
 * (CnnSynapse / RnnSynapse / VitSynapse all extend GraphOLink).
 */
export class Child<B = unknown> extends GraphOLink<B> {
    public constructor(parent?: INode, child?: INode) {
        // The identity is set BEFORE the endpoints are wired, and the order is
        // load-bearing. Attaching an endpoint calls `node.add(link)`, which
        // invalidates the child's derived parent cache only for links it
        // recognises as a `Child`. Recognition reads `type`, so wiring first
        // and naming afterwards would attach a link nothing could identify
        // during the one moment it matters, and the cache would keep a stale
        // parent for the life of the node.
        super();
        this.type = "child";
        // oini = parent, ofin = child; each setter registers the link on the
        // node's onsc / opsc.
        this.oini = parent ?? null;
        this.ofin = child ?? null;
    }
}

/**
 * `ApplyTo` relation: a STRUCTURAL link (not a dataflow channel) by which a
 * FAULT (or any operator node, `oini`) APPLIES its physics to a TARGET model
 * (`ofin`). Directed source -> target; the target surfaces its incoming
 * `ApplyTo` links via `opsc` filtered to `ApplyTo`, then drives them with
 * `link.oini.applyTo(this, ctx)` (the fault reads the target model's
 * PROPERTIES directly, e.g. `motor.rotorMass` / `motor.airGap`, and accumulates
 * its effect). Properties are read from the model, NOT published as ports; a
 * port is a runtime DATA relation, an `ApplyTo` is a MODEL-consumption relation.
 *
 * Carries no payload; `type` is the ontology id "applyTo" (`isBindingRelation:
 * false`, structural). Idiomatic alongside the other typed link subclasses
 * (Child, CnnSynapse, ...). The fault keeps its own tuning editables (severity,
 * defect counts, ...); the target validates acceptance (`acceptFault`).
 */
export class ApplyTo<B = unknown> extends GraphOLink<B> {
    public constructor(fault?: INode, target?: INode) {
        // Identity before attachment, for the same reason as `Child`: anything
        // that inspects a link while it is being wired can only go by `type`.
        super();
        this.type = "applyTo";
        // oini = fault (source), ofin = target model.
        this.oini = fault ?? null;
        this.ofin = target ?? null;
    }
}
