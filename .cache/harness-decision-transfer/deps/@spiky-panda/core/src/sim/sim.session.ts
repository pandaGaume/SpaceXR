import { IRuntimeGraph } from "../execution/execution.interfaces";
import { Session } from "../execution/execution.session";
import { ISimSession, SimPhase } from "./sim.interfaces";

/**
 * Sim session: extends the generic Session with a phase iteration
 * loop. At each tick the SimSession walks its declared phases in
 * order, setting currentPhase before each underlying Session.run(t).
 * The execution scheduler stays phase-agnostic; phase awareness is
 * pulled into nodes that implement ISupportsPhasing (typically via
 * the PhasedNode base class).
 *
 * Default phases is [Step], which makes SimSession behave identically
 * to a plain Session for graphs that do not need a pre/post pass.
 */
export class SimSession extends Session implements ISimSession {
    public readonly phases: ReadonlyArray<SimPhase>;
    public currentPhase: SimPhase = SimPhase.Step;

    public constructor(graph: IRuntimeGraph, phases: ReadonlyArray<SimPhase> = [SimPhase.Step]) {
        super(graph);
        this.phases = phases;
        this.currentPhase = phases[0] ?? SimPhase.Step;
    }

    /**
     * Full tick: iterate self.phases, set currentPhase, dispatch the
     * underlying scheduler for each phase. The scheduler picks
     * RunDynamic or RunStatic based on graph.mode.
     */
    public override run(t: number): void {
        for (const phase of this.phases) {
            this.currentPhase = phase;
            super.run(t);
        }
    }

    /**
     * Run a single named phase. Useful for testing and for callers that
     * want fine-grained control over the phase iteration (e.g. injecting
     * external state between phases).
     */
    public runPhase(phase: SimPhase, t: number): void {
        this.currentPhase = phase;
        super.run(t);
    }
}
