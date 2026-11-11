// ═══════════════════════════════════════════════════════════════════════════
// RunnableNode : base for IRuntimeNode + IRunnable.
//
// Every concrete runtime node that has a start/stop lifecycle extends
// this class. It guarantees:
//   - the standard control ports (_start, _stop, _started, _stopped) on
//     top of the inherited _enable/_enabled ports;
//   - a status field with onPropertyChanged notifications so external
//     observers (toolbar, UI badges) can reflect the lifecycle without
//     polling.
//
// Subclasses implement start()/stop() with the work that actually
// transitions the node (open a file, spin up a worker, connect to a
// device, ...) and call super-helpers to keep status + control ports
// in sync. Reacting to incoming _start/_stop trigger channels is left
// to the subclass's fire() implementation (or a future generic helper).
// ═══════════════════════════════════════════════════════════════════════════

import {
    CONTROL_PORT_START,
    CONTROL_PORT_STARTED,
    CONTROL_PORT_STOP,
    CONTROL_PORT_STOPPED,
    ENABLED_OUTPUT_PORT,
    ENABLE_INPUT_PORT,
    publishControlOutput,
    STARTED_OUTPUT_PORT,
    START_INPUT_PORT,
    STOPPED_OUTPUT_PORT,
    STOP_INPUT_PORT,
} from "./control-ports";
import { IChannel, IPortDescriptor, IRunnable, ISession, inSlotOf, RunStatus } from "./execution.interfaces";
import { RuntimeNode } from "./execution.node";

export abstract class RunnableNode<B = unknown> extends RuntimeNode<B> implements IRunnable {
    private _status: RunStatus = "idle";

    public get status(): RunStatus {
        return this._status;
    }

    /** Standard control inputs: enable + start + stop. */
    public override readonly controlInputPorts: ReadonlyArray<IPortDescriptor> = [ENABLE_INPUT_PORT, START_INPUT_PORT, STOP_INPUT_PORT];

    /** Standard control outputs: enabled state + started/stopped triggers. */
    public override readonly controlOutputPorts: ReadonlyArray<IPortDescriptor> = [ENABLED_OUTPUT_PORT, STARTED_OUTPUT_PORT, STOPPED_OUTPUT_PORT];

    public abstract start(): void | Promise<void>;
    public abstract stop(): void | Promise<void>;

    /**
     * Subclasses call this from within start() at lifecycle transitions
     * to keep status in sync and fire onPropertyChanged on "status" so
     * external observers can react.
     */
    protected _setStatus(next: RunStatus): void {
        const prev = this._status;
        if (prev === next) return;
        this._status = next;
        this.notifyPropertyChanged("status", prev, next);
    }

    /**
     * Drains _enable (via super), then scans incoming _start / _stop
     * trigger channels. The first received _start invokes start() on
     * the node, the first received _stop invokes stop(); transitions
     * publish on _started / _stopped respectively so downstream nodes
     * can chain (Begin-Play → controller._start → recorder._start ...).
     * Errors during start/stop transition the status to "failed".
     */
    public override processControlInputs(session: ISession): void {
        super.processControlInputs(session);

        const links = session.graph.links as ReadonlyArray<IChannel>;
        let startTriggered = false;
        let stopTriggered = false;

        for (const link of this.opsc<IChannel>()) {
            if (!link.enabled) continue;
            const idx = links.indexOf(link);
            if (idx < 0) continue;
            if (!session.linkStates[idx].ready) continue;
            const destSlot = inSlotOf(link);
            if (destSlot === CONTROL_PORT_START) {
                session.consume(idx);
                startTriggered = true;
            } else if (destSlot === CONTROL_PORT_STOP) {
                session.consume(idx);
                stopTriggered = true;
            }
        }

        if (startTriggered && this._status !== "started" && this._status !== "starting") {
            this._invokeStart(session);
        }
        if (stopTriggered && this._status !== "stopped" && this._status !== "stopping" && this._status !== "idle") {
            this._invokeStop(session);
        }
    }

    private _invokeStart(session: ISession): void {
        this._setStatus("starting");
        try {
            const result = this.start();
            if (result instanceof Promise) {
                result.then(
                    () => {
                        this._setStatus("started");
                        publishControlOutput(this, session, CONTROL_PORT_STARTED, true);
                    },
                    () => {
                        this._setStatus("failed");
                    }
                );
            } else {
                this._setStatus("started");
                publishControlOutput(this, session, CONTROL_PORT_STARTED, true);
            }
        } catch {
            this._setStatus("failed");
        }
    }

    private _invokeStop(session: ISession): void {
        this._setStatus("stopping");
        try {
            const result = this.stop();
            if (result instanceof Promise) {
                result.then(
                    () => {
                        this._setStatus("stopped");
                        publishControlOutput(this, session, CONTROL_PORT_STOPPED, true);
                    },
                    () => {
                        this._setStatus("failed");
                    }
                );
            } else {
                this._setStatus("stopped");
                publishControlOutput(this, session, CONTROL_PORT_STOPPED, true);
            }
        } catch {
            this._setStatus("failed");
        }
    }
}
