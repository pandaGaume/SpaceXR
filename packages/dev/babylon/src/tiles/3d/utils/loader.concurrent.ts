
type LoaderFn<T> = (url: string, signal: AbortSignal) => Promise<T>;

class CancelledError extends Error {
  constructor(message = "Cancelled") { super(message); this.name = "CancelledError"; }
}

type QueueStatus = "fulfilled" | "rejected" | "cancelled";
interface SettledEvent<T> {
  url: string;
  status: QueueStatus;
  value?: T;
  reason?: any;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

interface EnqueueOpts<T> {
  onSettled?: (e: SettledEvent<T>) => void;
  // (room for: priority, metadata, onProgress, etc.)
}

interface QueueItem<T> {
  url: string;
  resolve: (v: T) => void;
  reject: (e: any) => void;
  onSettled?: (e: SettledEvent<T>) => void;
}

type Listener<T> = (e: SettledEvent<T>) => void;

export class ConcurrentLoaderQueue<T = ArrayBuffer> {
  private readonly loader: LoaderFn<T>;
  private concurrency: number;
  private running = 0;

  private queue: QueueItem<T>[] = [];
  private queuedByUrl = new Map<string, QueueItem<T>>();
  private inFlight = new Map<string, { controller: AbortController }>();

  // --- Event listeners
  private settledListeners = new Set<Listener<T>>();

  constructor(loader: LoaderFn<T>, concurrency = 4) {
    if (concurrency < 1) throw new Error("concurrency must be >= 1");
    this.loader = loader;
    this.concurrency = concurrency;
  }

  /** Subscribe to per-item completion (success or error). */
  public on(event: "settled", listener: Listener<T>): () => void {
    if (event !== "settled") throw new Error("Only 'settled' supported");
    this.settledListeners.add(listener);
    return () => this.settledListeners.delete(listener);
  }

  public setConcurrency(n: number): void {
    if (n < 1) throw new Error("concurrency must be >= 1");
    this.concurrency = n;
    this.tick();
  }

  /** Enqueue a URL; optional per-item onSettled callback. */
  public enqueue(url: string, opts?: EnqueueOpts<T>): Promise<T> {
    const existing = this.queuedByUrl.get(url);
    if (existing) {
      // Chain per-item callback (if provided) to the existing item
      if (opts?.onSettled) {
        const prev = existing.onSettled;
        existing.onSettled = prev
          ? (e) => { try { prev(e); } finally { try { opts.onSettled!(e); } catch {} } }
          : opts.onSettled;
      }
      return new Promise<T>((resolve, reject) => {
        existing.resolve = this.chainResolve(existing.resolve, resolve);
        existing.reject = this.chainReject(existing.reject, reject);
      });
    }

    let _resolve!: (v: T) => void;
    let _reject!: (e: any) => void;
    const p = new Promise<T>((resolve, reject) => { _resolve = resolve; _reject = reject; });

    const item: QueueItem<T> = { url, resolve: _resolve, reject: _reject, onSettled: opts?.onSettled };

    this.queue.push(item);
    this.queuedByUrl.set(url, item);
    this.tick();
    return p;
  }

  /** Cancel a URL only if it hasn't started yet. */
  public cancelPending(url: string): boolean {
    const item = this.queuedByUrl.get(url);
    if (!item) return false;

    const idx = this.queue.indexOf(item);
    if (idx >= 0) this.queue.splice(idx, 1);
    this.queuedByUrl.delete(url);

    const now = performance.now();
    const evt: SettledEvent<T> = {
      url,
      status: "cancelled",
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      reason: new CancelledError(`Cancelled pending: ${url}`),
    };

    item.reject(evt.reason);
    this.emitSettled(evt, item.onSettled);
    return true;
  }

  public cancelAllPending(): void {
    // Copy because emit will mutate state
    const items = [...this.queue];
    this.queue = [];
    this.queuedByUrl.clear();
    for (const item of items) {
      const now = performance.now();
      const reason = new CancelledError(`Cancelled pending: ${item.url}`);
      item.reject(reason);
      this.emitSettled(
        { url: item.url, status: "cancelled", startedAt: now, endedAt: now, durationMs: 0, reason },
        item.onSettled
      );
    }
  }

  public get pendingCount(): number { return this.queue.length; }
  public get runningCount(): number { return this.running; }

  // ------------------------------------------------------------

  private tick(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.queuedByUrl.delete(item.url);
      this.start(item);
    }
  }

  private start(item: QueueItem<T>): void {
    const controller = new AbortController();
    this.inFlight.set(item.url, { controller });
    this.running++;

    const startedAt = performance.now();

    this.loader(item.url, controller.signal)
      .then((value) => {
        item.resolve(value);
        const endedAt = performance.now();
        this.emitSettled(
          { url: item.url, status: "fulfilled", value, startedAt, endedAt, durationMs: endedAt - startedAt },
          item.onSettled
        );
      })
      .catch((reason) => {
        item.reject(reason);
        const endedAt = performance.now();
        this.emitSettled(
          { url: item.url, status: "rejected", reason, startedAt, endedAt, durationMs: endedAt - startedAt },
          item.onSettled
        );
      })
      .finally(() => {
        this.inFlight.delete(item.url);
        this.running--;
        this.tick();
      });
  }

  private emitSettled(evt: SettledEvent<T>, perItem?: (e: SettledEvent<T>) => void) {
    // Per-item first
    try { perItem?.(evt); } catch {}
    // Then global listeners
    for (const l of this.settledListeners) {
      try { l(evt); } catch {}
    }
  }

  private chainResolve(a: (v: T) => void, b: (v: T) => void) {
    return (v: T) => { try { a(v); } finally { try { b(v); } catch {} } };
  }
  private chainReject(a: (e: any) => void, b: (e: any) => void) {
    return (e: any) => { try { a(e); } finally { try { b(e); } catch {} } };
  }
}
