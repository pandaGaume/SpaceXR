import { Comparator, isPriorityQueue, PriorityQueue } from "../collections";

export type Task<T, R = unknown> = {
    item: T;
    run: (item: T) => R | Promise<R>;
    // optional signal to abort
    signal?: AbortSignal;
};

export class TaskScheduler<T, R = unknown> {
    public static readonly DefaultMaxJob = 6;

    private readonly _pq: PriorityQueue<Task<T, R>>;
    private _inFlight = 0;

    public constructor(
        compare: Comparator<Task<T, R>> | PriorityQueue<Task<T, R>>,
        public maxJobs = TaskScheduler.DefaultMaxJob,
        private _schedule: (f: () => void) => void = (f) => requestAnimationFrame(f)
    ) {
        this._pq = isPriorityQueue<Task<T, R>>(compare) ? compare : new PriorityQueue<Task<T, R>>(compare);
    }

    get running(): boolean {
        return this._inFlight > 0 || !this._pq.isEmpty();
    }

    public addAsync(task: Task<T, R>): Promise<R> {
        return new Promise<R>((resolve, reject) => {
            // optionnel: écouter abort
            if (task.signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
            const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
            task.signal?.addEventListener("abort", onAbort, { once: true });

            this._pq.enqueue(task);
            this._schedule(() => this._drain(resolve, reject, onAbort));
        });
    }

    private _drain(resolve: (v: R) => void, reject: (e: unknown) => void, onAbort?: () => void) {
        while (this._inFlight < this.maxJobs && !this._pq.isEmpty()) {
            this._inFlight++;
            const t = this._pq.dequeue()!;
            Promise.resolve()
                .then(() => t.run(t.item))
                .then(resolve, reject)
                .finally(() => {
                    this._inFlight--;
                    onAbort && t.signal?.removeEventListener("abort", onAbort as any);
                    if (this.running) this._schedule(() => this._drain(resolve, reject, onAbort));
                });
        }
    }

    clear() {
        this._pq.clear();
    }
}
