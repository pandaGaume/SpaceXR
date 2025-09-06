import { IQueue } from "./collections.interfaces";

/**
 * PriorityQueue<T>
 * - Binary heap with O(log n) push/pop, O(1) peek
 * - Comparator: return < 0 if a has HIGHER priority than b
 */
export class PriorityQueue<T> implements IQueue<T> {
    private _heap: T[] = [];
    private readonly _compare: (a: T, b: T) => number;

    constructor(compare: (a: T, b: T) => number) {
        this._compare = compare;
    }

    /** Number of items */
    public size(): number {
        return this._heap.length;
    }

    /** True if empty */
    public isEmpty(): boolean {
        return this._heap.length === 0;
    }

    /** Peek best item (highest priority) without removing it */
    public peek(): T | undefined {
        return this._heap[0];
    }

    /** Push an item (O(log n)) */
    public enqueue(value: T): void {
        this._heap.push(value);
        this._siftUp(this._heap.length - 1);
    }

    /** Pop best item (O(log n)) */
    public dequeue(): T | undefined {
        const n = this._heap.length;
        if (n === 0) return undefined;
        this._swap(0, n - 1);
        const out = this._heap.pop();
        if (this._heap.length > 0) this._siftDown(0);
        return out;
    }

    /** Remove all items */
    public clear(): void {
        this._heap.length = 0;
    }

    /** Build a Min-heap by numeric key: smaller key = higher priority */
    public static fromMin<T>(key: (v: T) => number): PriorityQueue<T> {
        return new PriorityQueue<T>((a, b) => key(a) - key(b));
    }

    /** Build a Max-heap by numeric key: larger key = higher priority */
    public static fromMax<T>(key: (v: T) => number): PriorityQueue<T> {
        return new PriorityQueue<T>((a, b) => key(b) - key(a));
    }

    // --- internals ---

    private _siftUp(i: number): void {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this._compare(this._heap[i], this._heap[p]) < 0) {
                this._swap(i, p);
                i = p;
            } else break;
        }
    }

    private _siftDown(i: number): void {
        const n = this._heap.length;
        while (true) {
            const l = (i << 1) + 1;
            const r = l + 1;
            let best = i;

            if (l < n && this._compare(this._heap[l], this._heap[best]) < 0) best = l;
            if (r < n && this._compare(this._heap[r], this._heap[best]) < 0) best = r;

            if (best !== i) {
                this._swap(i, best);
                i = best;
            } else break;
        }
    }

    private _swap(a: number, b: number): void {
        const tmp = this._heap[a];
        this._heap[a] = this._heap[b];
        this._heap[b] = tmp;
    }

    public includes(item: T): boolean {
        return this._heap.includes(item);
    }
}
