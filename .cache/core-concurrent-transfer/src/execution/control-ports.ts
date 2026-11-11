// ═══════════════════════════════════════════════════════════════════════════
// Control-port convention
//
// Reserved slot names that mark a port as part of the runtime control
// plane (vs. the domain dataflow). All control slots start with "_".
// Pairing convention:
//
//   verb-style    → input  (drives the action)
//     "_enable"   carries boolean, sets node.enabled
//     "_start"    carries trigger, calls IRunnable.start()
//     "_stop"     carries trigger, calls IRunnable.stop()
//
//   adjective/past → output (broadcasts current state)
//     "_enabled"  carries boolean, current node.enabled state
//     "_started"  carries trigger, fired after start() succeeds
//     "_stopped"  carries trigger, fired after stop() succeeds
//
// Nodes that need control ports declare them via IDeclaresControlPorts
// (alongside their data ports declared via IDeclaresPorts). The editor
// renders the two groups distinctly; the runtime treats them as normal
// channels carrying typed values, so the wiring is uniform end-to-end.
// ═══════════════════════════════════════════════════════════════════════════

import type { IChannel, IPortDescriptor, IRuntimeNode, ISession } from "./execution.interfaces";

export const CONTROL_PORT_ENABLE = "_enable";
export const CONTROL_PORT_ENABLED = "_enabled";
export const CONTROL_PORT_START = "_start";
export const CONTROL_PORT_STOP = "_stop";
export const CONTROL_PORT_STARTED = "_started";
export const CONTROL_PORT_STOPPED = "_stopped";

/** Boolean input: when received, sets node.enabled to the value. */
export const ENABLE_INPUT_PORT: IPortDescriptor = { slot: CONTROL_PORT_ENABLE, optional: true, type: "boolean" };
/** Boolean output: emits node.enabled state changes. */
export const ENABLED_OUTPUT_PORT: IPortDescriptor = { slot: CONTROL_PORT_ENABLED, optional: true, type: "boolean" };
/** Trigger input: calls IRunnable.start() on the host node. */
export const START_INPUT_PORT: IPortDescriptor = { slot: CONTROL_PORT_START, optional: true, type: "trigger" };
/** Trigger input: calls IRunnable.stop() on the host node. */
export const STOP_INPUT_PORT: IPortDescriptor = { slot: CONTROL_PORT_STOP, optional: true, type: "trigger" };
/** Trigger output: fired after IRunnable.start() succeeds. */
export const STARTED_OUTPUT_PORT: IPortDescriptor = { slot: CONTROL_PORT_STARTED, optional: true, type: "trigger" };
/** Trigger output: fired after IRunnable.stop() succeeds. */
export const STOPPED_OUTPUT_PORT: IPortDescriptor = { slot: CONTROL_PORT_STOPPED, optional: true, type: "trigger" };

/** Returns true if the given slot name follows the control-port convention. */
export function isControlSlot(slot: string | number): boolean {
    return typeof slot === "string" && slot.length > 0 && slot.charCodeAt(0) === 95; // "_"
}

/**
 * Free function (not a class method) that publishes `value` on every
 * outgoing channel of `node` whose slot matches `controlSlot`. Kept
 * standalone so RuntimeNode, RuntimeGraph, and any future IRuntimeNode
 * implementation can reuse it without coupling to a base class.
 */
export function publishControlOutput(node: IRuntimeNode, session: ISession, controlSlot: string, value: unknown): void {
    const links = session.graph.links as ReadonlyArray<IChannel>;
    for (const link of node.onsc<IChannel>()) {
        if (link.slot !== controlSlot) continue;
        if (!link.enabled) continue;
        const idx = links.indexOf(link);
        if (idx < 0) continue;
        session.publish(idx, value);
    }
}
