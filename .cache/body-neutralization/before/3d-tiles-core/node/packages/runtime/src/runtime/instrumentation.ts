import type { RuntimeMetricName, IRuntimeMetric } from "../ports";
import type { IResolvedRuntimeCacheOptions, IRuntimeCacheCounters } from "./cache";

export interface IRuntimeInstrumentationOptions {
    enabled?: boolean;
}

export interface IRuntimeMetricAggregate {
    count: number;
    sum: number;
    min: number;
    max: number;
    latest: number;
    unit: IRuntimeMetric["unit"];
}

export interface IRuntimeNodeStatistics {
    total: number;
    explicit: number;
    implicit: number;
    selected: number;
    visible: number;
    /** Selected tiles next to a tile two or more levels coarser in the last frame, with `quadtreeBalance`. */
    unbalanced: number;
}

export interface IRuntimeContentStatistics {
    total: number;
    idle: number;
    queued: number;
    loading: number;
    ready: number;
    error: number;
    cancelled: number;
    attached: number;
    cached: number;
    cpuBytes: number;
    gpuBytes: number;
    networkBytes: number;
}

export interface IRuntimeSubtreeStatistics {
    total: number;
    idle: number;
    queued: number;
    loading: number;
    ready: number;
    error: number;
    cancelled: number;
    cached: number;
    bytes: number;
}

export interface IRuntimeCacheStatistics extends IRuntimeCacheCounters {
    enabled: boolean;
    limits: IResolvedRuntimeCacheOptions;
}

export interface IRuntimeStateStatistics {
    frame: number;
    pendingLoads: number;
    nodes: IRuntimeNodeStatistics;
    contents: IRuntimeContentStatistics;
    subtrees: IRuntimeSubtreeStatistics;
    cache: IRuntimeCacheStatistics;
}

export interface IRuntimeStatisticsSnapshot extends IRuntimeStateStatistics {
    runtimeId: string;
    timestamp: number;
    collectionStartedAt: number;
    metrics: Readonly<Partial<Record<RuntimeMetricName, IRuntimeMetricAggregate>>>;
}

export type RuntimeStatisticsListener = (snapshot: IRuntimeStatisticsSnapshot) => void;

export class RuntimeInstrumentation {
    private collectionEnabled: boolean;
    private collectionStartedAt = Date.now();
    private readonly aggregates = new Map<RuntimeMetricName, IRuntimeMetricAggregate>();
    private readonly listeners = new Set<RuntimeStatisticsListener>();

    public constructor(
        options: boolean | IRuntimeInstrumentationOptions | undefined,
        private readonly runtimeId: string,
        private readonly stateProvider: () => IRuntimeStateStatistics,
    ) {
        this.collectionEnabled = typeof options === "boolean" ? options : (options?.enabled ?? true);
    }

    public get enabled(): boolean {
        return this.collectionEnabled;
    }

    public get hasSubscribers(): boolean {
        return this.listeners.size > 0;
    }

    public setEnabled(enabled: boolean): void {
        this.collectionEnabled = enabled;
    }

    public reset(): void {
        this.aggregates.clear();
        this.collectionStartedAt = Date.now();
    }

    public record(metric: IRuntimeMetric): void {
        if (!this.collectionEnabled) return;
        const aggregate = this.aggregates.get(metric.name);
        if (!aggregate) {
            this.aggregates.set(metric.name, {
                count: 1,
                sum: metric.value,
                min: metric.value,
                max: metric.value,
                latest: metric.value,
                unit: metric.unit,
            });
            return;
        }
        aggregate.count++;
        aggregate.sum += metric.value;
        aggregate.min = Math.min(aggregate.min, metric.value);
        aggregate.max = Math.max(aggregate.max, metric.value);
        aggregate.latest = metric.value;
        aggregate.unit = metric.unit;
    }

    public snapshot(): IRuntimeStatisticsSnapshot {
        const metrics: Partial<Record<RuntimeMetricName, IRuntimeMetricAggregate>> = {};
        for (const [name, aggregate] of this.aggregates) metrics[name] = { ...aggregate };
        return {
            runtimeId: this.runtimeId,
            timestamp: Date.now(),
            collectionStartedAt: this.collectionStartedAt,
            ...this.stateProvider(),
            metrics,
        };
    }

    public subscribe(listener: RuntimeStatisticsListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public publish(): void {
        if (!this.collectionEnabled || this.listeners.size === 0) return;
        const snapshot = this.snapshot();
        for (const listener of this.listeners) {
            try {
                listener(snapshot);
            } catch {
                // Statistics observers must not interrupt traversal or cache enforcement.
            }
        }
    }

    public clear(): void {
        this.listeners.clear();
        this.aggregates.clear();
    }
}
