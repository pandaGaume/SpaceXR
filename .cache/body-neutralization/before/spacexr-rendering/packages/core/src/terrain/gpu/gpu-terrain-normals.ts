import { tileAddressKey as key, type ITileAddress } from "@spacexr/tiles";

import type { BabylonRasterPages } from "../../raster/raster-pages";

/** Normal sources follow only the displayed terrain cut and never participate in geometry selection or readiness. */
export class GpuTerrainNormals {
    private readonly queued = new Map<string, ITileAddress>();
    private readonly loading = new Map<string, { address: ITileAddress; controller: AbortController }>();
    private readonly cached = new Map<string, ITileAddress>();
    private readonly wanted = new Map<string, ITileAddress>();
    private readonly retryAfter = new Map<string, number>();
    private disposed = false;
    private nextRetry = Number.POSITIVE_INFINITY;

    public constructor(
        public readonly pages: BabylonRasterPages,
        public readonly maximumConcurrentLoads = 4,
        public readonly maximumPages = 256,
    ) {}

    /** Requests only visible source data, never a generated geometry level or a hidden ready tile. */
    private request(address: ITileAddress): void {
        if (this.disposed) return;
        const source = this.pages.pyramid.areaOf(address).ancestor;
        const id = key(source);
        if (!this.wanted.has(id)) return;
        if (this.cached.has(id)) {
            this.cached.delete(id);
            this.cached.set(id, source);
            return;
        }
        if (this.queued.has(id) || this.loading.has(id) || (this.retryAfter.get(id) ?? 0) > performance.now()) return;
        if (this.queued.size >= this.maximumPages) {
            const obsolete = this.wanted.has(id) ? [...this.queued.keys()].find((candidate) => !this.wanted.has(candidate)) : undefined;
            if (obsolete === undefined) return;
            this.queued.delete(obsolete);
        }
        this.queued.set(id, source);
        this.pump();
    }

    /** Visible sources have priority over optional preparation, and cannot be evicted to load hidden pages. */
    public sync(addresses: readonly ITileAddress[]): void {
        this.wanted.clear();
        for (const address of addresses) {
            const source = this.pages.pyramid.areaOf(address).ancestor;
            this.wanted.set(key(source), source);
        }
        for (const id of this.queued.keys()) if (!this.wanted.has(id)) this.queued.delete(id);
        for (const [id, pending] of this.loading) if (!this.wanted.has(id)) pending.controller.abort();
        for (const address of this.wanted.values()) this.request(address);
        this.pump();
    }

    /** Retries transient source failures on a timer, independently of camera rotation. */
    public update(): void {
        if (performance.now() < this.nextRetry) return;
        this.nextRetry = Number.POSITIVE_INFINITY;
        for (const [id, until] of this.retryAfter) {
            if (until <= performance.now()) this.retryAfter.delete(id);
            else this.nextRetry = Math.min(this.nextRetry, until);
        }
        for (const source of this.wanted.values()) this.request(source);
    }

    /** The exact physical source page; a missing source leaves the DEM-normal fallback active. */
    public layer(address: ITileAddress): number | undefined {
        return this.pages.resident.get(this.pages.pyramid.areaOf(address).ancestor);
    }

    public dispose(): void {
        this.disposed = true;
        this.queued.clear();
        for (const { controller } of this.loading.values()) controller.abort();
        for (const address of this.cached.values()) {
            this.pages.release(address);
            this.pages.pyramid.release(address);
        }
        this.cached.clear();
        this.wanted.clear();
        this.retryAfter.clear();
    }

    private pump(): void {
        while (!this.disposed && this.loading.size < this.maximumConcurrentLoads && this.queued.size > 0) {
            const candidate = [...this.queued].find(([id]) => this.wanted.has(id)) ?? this.queued.entries().next().value!;
            const [id, address] = candidate;
            if (this.cached.size + this.loading.size >= this.maximumPages) {
                const obsolete = [...this.cached].find(([cachedId]) => !this.wanted.has(cachedId));
                if (!obsolete) return;
                const [oldId, oldAddress] = obsolete;
                this.cached.delete(oldId);
                this.pages.release(oldAddress);
                this.pages.pyramid.release(oldAddress);
            }
            this.queued.delete(id);
            const controller = new AbortController();
            this.loading.set(id, { address, controller });
            this.pages.pyramid.retain(address);
            let retained = false;
            void this.pages
                .load(address, controller.signal)
                .then((page) => {
                    if (this.disposed || controller.signal.aborted || !this.wanted.has(id) || !page) {
                        if (page) this.pages.release(address);
                        if (!page && !this.disposed && this.wanted.has(id) && !controller.signal.aborted) this.retry(id);
                        return;
                    }
                    this.cached.set(id, address);
                    retained = true;
                })
                .catch(() => {
                    if (!controller.signal.aborted) this.retry(id);
                })
                .finally(() => {
                    if (!retained) this.pages.pyramid.release(address);
                    this.loading.delete(id);
                    if (!this.disposed) for (const source of this.wanted.values()) this.request(source);
                    this.pump();
                });
        }
    }

    private retry(id: string): void {
        const until = performance.now() + 5000;
        this.retryAfter.set(id, until);
        this.nextRetry = Math.min(this.nextRetry, until);
    }
}
