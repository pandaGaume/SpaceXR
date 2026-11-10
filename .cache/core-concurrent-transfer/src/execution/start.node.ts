// ═══════════════════════════════════════════════════════════════════════════
// StartNode : Begin-Play style entry point for a runtime graph.
//
// Modeled after Unreal Engine's BeginPlay: a source node that publishes
// a one-shot trigger on its _started output when the surrounding
// session is started. Downstream RunnableNode instances wired to that
// trigger receive a signal on their _start input and can transition
// their own lifecycle, cascading the start across the graph.
//
// Lifecycle:
//   - Session.start() calls arm() on every StartNode of its graph,
//     setting an internal _pending flag.
//   - On the next Session.run(t), isReady() is true once (because
//     _pending), the node fires, publishes the trigger, and clears the
//     flag.
//   - Subsequent ticks see _pending=false → isReady()=false → no fire,
//     until Session.start() is called again.
//
// StartNode has no data ports and no _enable port: its sole purpose is
// to fire the lifecycle trigger.  The user can still disable it via
// the standard `enabled` field if they want to suppress it entirely.
// ═══════════════════════════════════════════════════════════════════════════

import { CONTROL_PORT_STARTED, STARTED_OUTPUT_PORT } from "./control-ports";
import { IChannel, IPortDescriptor, ISession } from "./execution.interfaces";
import { RuntimeNode } from "./execution.node";

export class StartNode extends RuntimeNode {
    private _pending = false;

    /** No control inputs: StartNode is a pure source. */
    public override readonly controlInputPorts: ReadonlyArray<IPortDescriptor> = [];
    /** Single trigger output: the Begin-Play signal. */
    public override readonly controlOutputPorts: ReadonlyArray<IPortDescriptor> = [STARTED_OUTPUT_PORT];

    /** Always-on: the enable toggle is hidden in the editor. The
     *  scheduler still respects `enabled` if set programmatically. */
    public override readonly supportsEnabling = false;

    /** Mark the node as fireable on the next tick. Session.start() calls
     *  this on every StartNode of the graph. */
    public arm(): void {
        this._pending = true;
    }

    /** Returns true the cycle after arm() until fire() consumes it. */
    public override isReady(_session: ISession): boolean {
        return this.enabled && this._pending;
    }

    public override fire(session: ISession, _t: number): void {
        if (!this._pending) return;
        this._pending = false;

        const links = session.graph.links as ReadonlyArray<IChannel>;
        for (const link of this.onsc<IChannel>()) {
            if (!link.enabled || link.slot !== CONTROL_PORT_STARTED) continue;
            const idx = links.indexOf(link);
            if (idx < 0) continue;
            session.publish(idx, true);
        }
    }
}
