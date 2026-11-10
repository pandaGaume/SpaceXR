import { cloneable, INode } from "../graph/graph.interfaces";
import { GraphOLink } from "../graph/graph.olink";
import { IChannel } from "./execution.interfaces";

/**
 * Concrete IChannel. Extends GraphOLink so source/target endpoints
 * stay managed by the existing graph layer; adds slot (input-port name
 * on the destination), delayed (the channel is pre-seeded with
 * initialValue at session reset, breaking feedback cycles), and the
 * inherited IEnabled.enabled toggle.
 */
export class Channel<T = unknown> extends GraphOLink implements IChannel<T> {
    @cloneable public slot: string | number;
    @cloneable public toSlot?: string | number;
    @cloneable public delayed: boolean;
    @cloneable public initialValue?: T;
    @cloneable public enabled: boolean;

    public constructor(oini?: INode, ofin?: INode, slot: string | number = 0, delayed: boolean = false, initialValue?: T, enabled: boolean = true, toSlot?: string | number) {
        // Set slot / toSlot / enabled BEFORE wiring the endpoints: attaching
        // to a node fires its routing hooks (nscAdded / pscAdded), which key
        // the channel by its slot. Passing the endpoints to super() would
        // attach them before these fields exist, keying the cache under
        // `undefined`. So construct unwired, set identity, then wire.
        super();
        this.slot = slot;
        this.toSlot = toSlot;
        this.delayed = delayed;
        this.initialValue = initialValue;
        this.enabled = enabled;
        this.oini = oini ?? null;
        this.ofin = ofin ?? null;
    }
}
