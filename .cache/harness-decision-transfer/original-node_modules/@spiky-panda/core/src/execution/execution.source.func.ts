import { IChannel, ISession } from "./execution.interfaces";
import { RuntimeNode } from "./execution.node";

/** A source recomputed from a thunk each tick: the constant drive voltage and
 *  the live-getter bridges (read another node's current output, no Z^-1 cell). */
export class FuncSource extends RuntimeNode {
    public constructor(private readonly _f: (t: number) => unknown) {
        super();
    }
    public override isReady(_s: ISession): boolean {
        return this.enabled;
    }
    public override fire(session: ISession, t: number): void {
        const links = session.graph.links as ReadonlyArray<IChannel>;
        for (const link of this.onsc<IChannel>()) {
            if (!link.enabled) continue;
            const idx = links.indexOf(link);
            if (idx >= 0) session.publish(idx, this._f(t));
        }
    }
}
