import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('.cache/core-decision-runtime/src/execution');
const change = (name, fn) => {
  const file = path.join(root, name);
  fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')));
};
change('execution.scheduler.ts', source => {
  source = source.replace('ISession, IStaticEligibility', 'ISession, ILinkRef, IStaticEligibility');
  const start = source.indexOf('    public static RunDynamic(');
  const end = source.indexOf('    public static RunStatic(', start);
  let body = source.slice(start, end)
    .replace('public static RunDynamic(session: ISession, t: number): void', 'private static *dynamicDispatch(session: ISession): Generator<IRuntimeNode | ILinkRef, void>')
    .replace('sess.deliverLinkRef(item);', 'yield item;')
    .replace('node.fire(session, t);', 'yield node;');
  const methods = `    /** Sync and async execution share the same native queue and readiness rules. */
    public static RunDynamic(session: ISession, t: number): void {
        for (const item of Scheduler.dynamicDispatch(session)) {
            if (isLinkRef(item)) (session as Session).deliverLinkRef(item);
            else item.fire(session, t);
        }
    }

    public static async RunDynamicAsync(session: ISession, t: number): Promise<void> {
        if (Scheduler.activeAsyncSessions.has(session)) {
            throw new Error("This session already has an active async traversal");
        }
        Scheduler.activeAsyncSessions.add(session);
        try {
            for (const item of Scheduler.dynamicDispatch(session)) {
                if (isLinkRef(item)) {
                    if (session.deliverLinkRefsAsync) await session.deliverLinkRefsAsync([item], t);
                    else (session as Session).deliverLinkRef(item);
                } else await item.fireAsync(session, t);
            }
        } finally {
            Scheduler.activeAsyncSessions.delete(session);
        }
    }

`;
  return source.slice(0, start) + methods + body + source.slice(end);
});
change('execution.graph.ts', source => source.replace(
  'await Scheduler.RunStaticAsync(target, t);',
  'await target.runAsync(t);'));
change('execution.interfaces.ts', source => source.replace(
  '    run(t: number): void;\n    reset(): void;',
  '    run(t: number): void;\n    /** Await async nodes using this graph\'s native scheduling mode. */\n    runAsync(t: number): Promise<void>;\n    reset(): void;'));
change('execution.session.ts', source => {
  const start = source.indexOf('    public run(t: number): void {');
  const dispatch = source.indexOf('        if (this.graph.mode === "dynamic") {', start);
  source = source.slice(0, start) + source.slice(start, dispatch).replace(
    'public run(t: number): void', 'private prepareRun(t: number): void') + `    }

    public async runAsync(t: number): Promise<void> {
        if (this.asyncRunning) throw new Error("This session already has an active async traversal");
        this.asyncRunning = true;
        try {
            this.prepareRun(t);
            if (this.graph.mode === "dynamic") await Scheduler.RunDynamicAsync(this, t);
            else if (this.graph.mode === "static") await Scheduler.RunStaticAsync(this, t);
            else throw new Error(\x60scheduler not implemented for mode "\x24{this.graph.mode}"\x60);
        } finally {
            this.asyncRunning = false;
        }
    }

    private asyncRunning = false;

    public run(t: number): void {
        if (this.asyncRunning) throw new Error("This session already has an active async traversal");
        this.prepareRun(t);
` + source.slice(dispatch);
  return source;
});
