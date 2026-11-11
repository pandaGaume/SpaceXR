// ═══════════════════════════════════════════════════════════════════════════
// StopNode : symmetric of StartNode, fires a one-shot _stopped trigger
// when the surrounding session is stopped.
//
// Wire its _stopped output to downstream RunnableNode instances'
// _stop input port to cascade a graceful teardown across the graph
// (End-Play counterpart of Begin-Play).
// ═══════════════════════════════════════════════════════════════════════════

import { CONTROL_PORT_STOPPED, STOPPED_OUTPUT_PORT } from "./control-ports";
import { IChannel, IPortDescriptor, ISession } from "./execution.interfaces";
import { RuntimeNode } from "./execution.node";

export class StopNode extends RuntimeNode {
    private _pending = false;

    public override readonly controlInputPorts: ReadonlyArray<IPortDescriptor> = [];
    public override readonly controlOutputPorts: ReadonlyArray<IPortDescriptor> = [STOPPED_OUTPUT_PORT];

    /** Always-on (see StartNode). */
    public override readonly supportsEnabling = false;

    public arm(): void {
        this._pending = true;
    }

    public override isReady(_session: ISession): boolean {
        return this.enabled && this._pending;
    }

    public override fire(session: ISession, _t: number): void {
        if (!this._pending) return;
        this._pending = false;

        const links = session.graph.links as ReadonlyArray<IChannel>;
        for (const link of this.onsc<IChannel>()) {
            if (!link.enabled || link.slot !== CONTROL_PORT_STOPPED) continue;
            const idx = links.indexOf(link);
            if (idx < 0) continue;
            session.publish(idx, true);
        }
    }
}
