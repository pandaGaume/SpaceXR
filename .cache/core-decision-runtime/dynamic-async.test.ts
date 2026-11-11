import { Channel, RuntimeGraph, RuntimeNode, Session, type INodeState, type ISession } from "spikypanda-core";
interface ITestState extends INodeState { count?: number; done?: boolean; failed?: boolean }
function testState(session: ISession, node: RuntimeNode): ITestState { return session.nodeStateOf(node)! as ITestState; }

class AsyncCounter extends RuntimeNode {
    public override isReady(session: ISession): boolean {
        return this.inputChannels("in").some(link => session.linkStateOf(link)?.ready);
    }
    public override fire(): never { throw new Error("Use async dispatch"); }
    public override async fireAsync(session: ISession): Promise<void> {
        const value = this.consumeLatest(session, "in") as number;
        await Promise.resolve();
        testState(session, this).count = value;
        if (value < 3) this.publishAll(session, "out", value + 1);
    }
}

test("Native dynamic async traversal executes a feedback cycle in one tick", async () => {
    const node = new AsyncCounter();
    class Relay extends RuntimeNode {
        public override fire(session: ISession): void {
            this.publishAll(session, "out", this.consumeLatest(session, "in"));
        }
    }
    const relay = new Relay();
    const link = new Channel<number>(undefined, undefined, "out");
    link.toSlot = "in"; link.oini = node; link.ofin = relay;
    const feedback = new Channel<number>(undefined, undefined, "out");
    feedback.toSlot = "in"; feedback.oini = relay; feedback.ofin = node;
    const graph = new RuntimeGraph([node, relay], [link, feedback], "dynamic");
    const session = new Session(graph);
    session.setInput(1, 1);
    await graph.runAsync(0, session);
    expect(testState(session, node).count).toBe(3);
    expect(session.tickIndex).toBe(1);
});

test("One waiting session does not prevent another session using the same node", async () => {
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { entered = resolve; });
    class WaitNode extends RuntimeNode {
        public override async fireAsync(session: ISession): Promise<void> {
            if (session === first) { entered(); await waiting; }
            testState(session, this).done = true;
        }
    }
    const node = new WaitNode();
    const graph = new RuntimeGraph([node], [], "dynamic");
    const first = new Session(graph);
    const second = new Session(graph);
    const running = graph.runAsync(0, first);
    await ready;
    try {
        await expect(graph.runAsync(0, first)).rejects.toThrow("active async");
        expect(() => first.run(1)).toThrow("active async");
        expect(() => first.reset()).toThrow("active async");
        await graph.runAsync(0, second);
        expect(testState(second, node).done).toBe(true);
        expect(testState(first, node).done).toBeUndefined();
        expect(first.tickIndex).toBe(1);
    } finally { release(); await running; }
    expect(testState(first, node).done).toBe(true);
});

test("Async dispatch advances clocks and attached solvers exactly once per tick", async () => {
    const graph = new RuntimeGraph([], [], "dynamic");
    const session = new Session(graph);
    const steps: number[] = [];
    session.attachSolver({ step: dt => { steps.push(dt); return { t: dt, microSteps: 1, maxError: 0, rhsEvals: 0 }; } });
    await graph.runAsync(0, session);
    await graph.runAsync(2, session);
    expect(session.tickIndex).toBe(2);
    expect(steps).toEqual([2]);
});

test("Async failure propagates and releases the session traversal guard", async () => {
    class FailsOnce extends RuntimeNode {
        public override async fireAsync(session: ISession): Promise<void> {
            const state = testState(session, this);
            if (!state.failed) { state.failed = true; throw new Error("First traversal failed"); }
            state.done = true;
        }
    }
    const node = new FailsOnce();
    const graph = new RuntimeGraph([node], [], "dynamic");
    const session = new Session(graph);
    await expect(graph.runAsync(0, session)).rejects.toThrow("First traversal failed");
    await graph.runAsync(1, session);
    expect(testState(session, node).done).toBe(true);
});

test("Dynamic async traversal promotes deferred tokens at the native tick", async () => {
    const node = new AsyncCounter();
    const link = new Channel<number>(undefined, node, "in");
    const graph = new RuntimeGraph([node], [link], "dynamic");
    const session = new Session(graph);
    session.publish(0, 3, { validAtTick: 2 });
    await graph.runAsync(0, session);
    expect(testState(session, node).count).toBeUndefined();
    await graph.runAsync(1, session);
    expect(testState(session, node).count).toBe(3);
});

