# Native asynchronous dynamic traversal

Date: 2026-11-06.

`Session.runAsync(t)` prepares the native clock, solver integration and deferred deliveries, then dispatches according to the graph's mode. `RuntimeGraph.runAsync(t, session)` delegates to it. Dynamic graphs can therefore await external operations while following feedback links inside the graph, without an application-side loop.

`Scheduler.RunDynamic` and `Scheduler.RunDynamicAsync` share one dispatch iterator. It retains the existing FIFO queue, slot buffers, readiness rules and signal-only deduplication. The synchronous driver invokes `fire`; the asynchronous driver awaits `fireAsync` and asynchronous delivery when present. Static async traversal remains available.

Async traversal guards are scoped to the session. A second session on the same graph can progress while the first awaits I/O. Concurrent run or reset on the same active session is rejected. This does not parallelize synchronous computation or prove fairness among branches in one session. Topology and control properties must not be edited while sessions use them.

Application loop termination, decision budgets and branch selection belong to graph nodes and links. The runtime does not invent an agent policy or retry failed effects.

Focused coverage is in `packages/tests/execution/dynamic-async.test.ts`: feedback cycle, independent concurrent sessions, reentry/reset rejection, clocks and solver integration, failure cleanup, and deferred delivery.

The existing execution dynamic/static tests contain three baseline failures reproduced before applying this change: disabled-channel delivery and two delayed-buffer overflows. They are recorded in the harness integration report and are not fixed by this change.

## Concurrent asynchronous operations

Nodes may opt in with `RuntimeNode.asyncMode = "concurrent"`. The native dynamic traversal admits the operation, continues processing independent nodes and waits for every admitted operation before returning. A session queue notification wakes an idle traversal when an unfinished operation publishes intermediate output. Default firing remains blocking; static async traversal retains its sequential semantics.

Concurrent work remains serialized per node and session. Additional input tokens retain their native buffer semantics. Exceptions are observed by the traversal, and admitted operations settle before the traversal leaves. This is cooperative I/O concurrency, not CPU parallelism, detached work or a second task scheduler around the graph.

`dynamic-async.test.ts` now also covers intermediate publication before operation completion, buffered tokens without same-node overlap, and settlement of admitted peer work after a concurrent failure. The harness uses this support for a delegated child session while an independent parent branch progresses.
