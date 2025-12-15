import { IQueue } from "./collections.interfaces";
import { PriorityQueue } from "./priorityQueue";


export type ActionQueueFn<R, T> = (data: R, signal: AbortSignal) => Promise<T>;

export class ActionCancelledError extends Error {
    constructor(msg = "Cancelled") {
        super(msg);
        this.name = "CancelledError";
    }
}

export enum ActionQueueStatus {
    fulfilled,
    rejected,
    cancelled,
}

export interface IActionQueueSettledEvent<R, T> {
    data: R;
    status: ActionQueueStatus;
    value?: T;
    reason?: any;
}

export interface IActionQueueEnqueueOpts<R, T> {
    onSettled?: (e: IActionQueueSettledEvent<R, T>) => void;
    priority?: number;
}

export interface IActionQueueItem<R, T> {
    data: R;
    resolve: (v: T) => void;
    reject: (e: any) => void;
    onSettled?: (e: IActionQueueSettledEvent<R, T>) => void;
    priority: number;
}

/**
 * Generic concurrent loader with pluggable queue.
 * Plug in a PriorityQueue<QueueItem<T>> that implements IQueue<T>.
 */
export class ConcurrentActionQueue<R, T> {
    private readonly _action: ActionQueueFn<R, T>;
    private concurrency: number;
    private running = 0;

    private readonly queue: IQueue<IActionQueueItem<R, T>>;
    private readonly queuedByData = new Map<unknown, IActionQueueItem<R, T>>();

    constructor(action: ActionQueueFn<R, T>, concurrency = 4, queue?: IQueue<IActionQueueItem<R, T>>) {
        this._action = action;
        this.queue = queue ?? new PriorityQueue<IActionQueueItem<R, T>>((a, b) => b.priority - a.priority);
        this.concurrency = concurrency;
    }

    public enqueue(data: R, opts?: IActionQueueEnqueueOpts<R, T>): Promise<T> {
        if (this.queuedByData.has(data)) {
            // dedupe: return same promise
            return new Promise<T>((resolve, reject) => {
                const item = this.queuedByData.get(data)!;
                item.resolve = this.chainResolve(item.resolve, resolve);
                item.reject = this.chainReject(item.reject, reject);
            });
        }

        let _resolve!: (v: T) => void;
        let _reject!: (e: any) => void;
        const promise = new Promise<T>((res, rej) => {
            _resolve = res;
            _reject = rej;
        });

        const item: IActionQueueItem<R, T> = {
            data,
            resolve: _resolve,
            reject: _reject,
            onSettled: opts?.onSettled,
            priority: opts?.priority ?? 0,
        };

        this.queuedByData.set(data, item);
        this.queue.enqueue(item);
        this.tick();
        return promise;
    }

    public cancelPending(data: R): boolean {
        const item = this.queuedByData.get(data);
        if (!item) return false;

        this.queuedByData.delete(data);
        item.reject(new ActionCancelledError());
        item.onSettled?.({ data, status: ActionQueueStatus.cancelled, reason: "Cancelled before start" });
        return true;
    }

    private tick(): void {
        while (this.running < this.concurrency && !this.queue.isEmpty()) {
            const item = this.queue.dequeue()!;
            this.queuedByData.delete(item.data);
            this.start(item);
        }
    }

    private start(item: IActionQueueItem<R, T>) {
        const controller = new AbortController();
        this.running++;
        this._action(item.data, controller.signal)
            .then((v) => {
                item.resolve(v);
                item.onSettled?.({ data: item.data, status: ActionQueueStatus.fulfilled, value: v });
            })
            .catch((err) => {
                item.reject(err);
                item.onSettled?.({ data: item.data, status: ActionQueueStatus.rejected, reason: err });
            })
            .finally(() => {
                this.running--;
                this.tick();
            });
    }

    private chainResolve(a: (v: T) => void, b: (v: T) => void) {
        return (v: T) => {
            a(v);
            b(v);
        };
    }
    private chainReject(a: (e: any) => void, b: (e: any) => void) {
        return (e: any) => {
            a(e);
            b(e);
        };
    }
}
