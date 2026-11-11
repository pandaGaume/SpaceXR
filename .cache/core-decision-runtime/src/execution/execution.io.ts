import { IChannel, IRuntimeNode, ISession, inSlotOf } from "./execution.interfaces";

/**
 * Walk the runtime node's incoming channels (opsc) and override the
 * supplied defaults with any value that is ready on a channel whose
 * slot matches a defaults key. Channels that are disabled, unmatched,
 * or whose link state is not ready are skipped; their corresponding
 * default carries through unchanged.
 *
 * The pattern factorises the "input wins over editable default" idiom
 * shared by Transform, Attitude and any future node that consumes
 * per-slot scalar / vector / quaternion / etc. inputs:
 *
 *     const eff = resolveSlotInputs(session, this, {
 *         yaw:   this._yaw,
 *         pitch: this._pitch,
 *         roll:  this._roll,
 *     });
 *
 * By default the channel value is consumed (one read clears the token).
 * Pass `{ consume: false }` to peek instead — useful when several
 * downstream nodes should see the same upstream value within one tick.
 */
export function resolveSlotInputs<T extends Record<string, unknown>>(
    session: ISession,
    node: IRuntimeNode,
    defaults: T,
    options?: {
        /** Default true: token is removed from the channel after read. */
        consume?: boolean;
        /**
         * Optional per-value type guard. When supplied, slot values
         * that fail the predicate are silently dropped and the default
         * carries through (the channel is still consumed though, so
         * the upstream producer is not stalled).
         */
        validator?: (slot: string, value: unknown) => boolean;
    }
): T {
    const consume = options?.consume !== false;
    const validator = options?.validator;
    const eff: Record<string, unknown> = { ...defaults };
    const incoming = node.opsc<IChannel>();
    for (const ch of incoming) {
        if (!ch.enabled) continue;
        const slot = String(inSlotOf(ch));
        if (!(slot in eff)) continue;
        const idx = session.graph.links.indexOf(ch);
        if (idx < 0 || !session.linkStates[idx].ready) continue;
        const value = consume ? session.consume(idx) : session.peek(idx);
        if (validator && !validator(slot, value)) continue;
        eff[slot] = value;
    }
    return eff as T;
}

/**
 * Publish `value` on every outgoing channel of `node` whose source slot
 * matches the FIRST output port — i.e. fans the value out to every
 * downstream wired to that single port. Returns true when at least one
 * channel was published on.
 *
 * The historical name kept "first output" wording because the original
 * 1-slot scheduler did not fan out: a node had at most one wire per
 * port and publish needed to land on that one wire. The FIFO refactor
 * does not change that constraint per channel, but a single output
 * port may now feed N destinations (Clock.t → Divide AND Comparator);
 * we have to publish on each, not just `outs[0]`.
 *
 * Multi-output nodes (Branch with `true`/`false`, RunnableNode with
 * `_started`/`_stopped`, ...) intentionally do NOT use this helper —
 * they iterate onsc themselves and key on slot. Here we mirror that
 * pattern but pin the slot to whatever the first onsc channel happens
 * to advertise, which matches the single-output-port contract this
 * function is documented for.
 */
export function publishToFirstOutput(session: ISession, node: IRuntimeNode, value: unknown): boolean {
    const outs = node.onsc<IChannel>();
    if (outs.length === 0) return false;
    const firstSlot = outs[0].slot;
    const links = session.graph.links as ReadonlyArray<IChannel>;
    let published = false;
    for (const link of outs) {
        if (link.slot !== firstSlot) continue;
        if (!link.enabled) continue;
        const idx = links.indexOf(link);
        if (idx < 0) continue;
        session.publish(idx, value);
        published = true;
    }
    return published;
}
