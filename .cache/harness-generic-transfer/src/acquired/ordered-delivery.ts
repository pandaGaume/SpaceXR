/** Parallel producers, ordered publication. A waiting producer keeps its place until resumed. */
export class OrderedDelivery {
    private tail: Promise<void> = Promise.resolve();
    private readonly pending = new Map<string, { turn: Promise<void>; finish: () => void }>();

    reserve(id: string): { turn: Promise<void>; finish: () => void } {
        const existing = this.pending.get(id);
        if (existing) return existing;
        const turn = this.tail;
        let release!: () => void;
        const completed = new Promise<void>((resolve) => { release = resolve; });
        this.tail = turn.then(() => completed);
        const ticket = { turn, finish: () => { if (this.pending.get(id) !== ticket) return; this.pending.delete(id); release(); } };
        this.pending.set(id, ticket);
        return ticket;
    }
}
