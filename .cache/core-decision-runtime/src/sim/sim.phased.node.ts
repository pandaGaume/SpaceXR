import type { ICartesian } from "../geometry";
import { IOlink } from "../graph/graph.interfaces";
import { cloneable } from "../graph/graph.interfaces";
import { ISession } from "../execution/execution.interfaces";
import { RuntimeNode } from "../execution/execution.node";
import { Nullable } from "../types";
import { IPhasedNodeBag, isSimSession, ISupportsPhasing, SimPhase } from "./sim.interfaces";

/**
 * Base class for nodes that gate themselves on the current sim phase.
 * Extends the generic RuntimeNode with a declared phases list and an
 * isReady() override that additionally checks the session's
 * currentPhase against this list.
 *
 * Nodes that fire in every phase (pure KPN, no phase awareness) extend
 * RuntimeNode directly. Nodes that participate only in PreStep, only
 * in Step, etc., extend PhasedNode and pass their phases list to the
 * constructor.
 *
 * The scheduler itself remains phase-agnostic; this class encodes the
 * phase-awareness as a node-side concern, matching our separation
 * between core/execution (pure dataflow) and core/sim (phase concept).
 */
export class PhasedNode<B extends IPhasedNodeBag = IPhasedNodeBag> extends RuntimeNode<B> implements ISupportsPhasing {
    @cloneable public phases: ReadonlyArray<SimPhase>;

    public constructor(phases: ReadonlyArray<SimPhase>, onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian, enabled: boolean = true) {
        super(onsc, opsc, position, enabled);
        this.phases = phases;
    }

    public override isReady(session: ISession): boolean {
        if (!super.isReady(session)) {
            return false;
        }
        // Phase-aware only when the session is a SimSession. Non-sim
        // sessions ignore phase declarations: phased nodes behave like
        // regular RuntimeNodes (always-eligible on data readiness).
        if (isSimSession(session)) {
            return this.phases.includes(session.currentPhase);
        }
        return true;
    }
}
