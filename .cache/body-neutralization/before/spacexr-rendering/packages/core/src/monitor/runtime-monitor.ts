// GPU frame time queries are engine extensions that Babylon 9 registers only when imported.
import "@babylonjs/core/Engines/AbstractEngine/abstractEngine.timeQuery.js";
// GPU frame time on WebGPU, with timestamp queries.
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.query.js";
import "@babylonjs/core/Engines/Extensions/engine.query.js";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { EngineInstrumentation } from "@babylonjs/core/Instrumentation/engineInstrumentation.js";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { IRuntimeStatisticsSnapshot, RuntimeInstrumentation } from "@spacexr/3d-tiles-runtime";

/** Renderer resources actually retained by a Babylon adapter, as opposed to the runtime cache estimates. */
export interface IBabylonTileResourceStatistics {
    handles: number;
    presented: number;
    created: number;
    released: number;
    cpuBytes: number;
    gpuBytes: number;
}

export interface IBabylonTileResourceStatisticsProvider {
    getStatistics(): IBabylonTileResourceStatistics;
}

/** Babylon render counters averaged over the last second. Times are in milliseconds. */
export interface IBabylonFrameStatistics {
    framesPerSecond: number;
    drawCalls: number;
    frameMilliseconds: number;
    /** Time between frames: JavaScript work outside rendering, such as runtime traversal and tile reception. */
    interFrameMilliseconds: number;
    renderMilliseconds: number;
    activeMeshesMilliseconds: number;
    /** Present only when the browser exposes GPU timer queries. */
    gpuFrameMilliseconds?: number;
}

export interface IJavaScriptHeapStatistics {
    usedBytes: number;
    limitBytes: number;
}

export interface IBabylonMonitorSnapshot {
    timestamp: number;
    startupMilliseconds: number;
    runtime: IRuntimeStatisticsSnapshot;
    frame: IBabylonFrameStatistics;
    resources?: IBabylonTileResourceStatistics;
    /** Present only in browsers exposing `performance.memory`. */
    heap?: IJavaScriptHeapStatistics;
}

export type BabylonMonitorListener = (snapshot: IBabylonMonitorSnapshot) => void;

export interface IBabylonRuntimeMonitorOptions {
    /** Defaults to true. A disabled monitor creates no Babylon instrumentation observers. */
    enabled?: boolean;
    /** Minimum time between publications. Defaults to 250 ms. */
    publishIntervalMilliseconds?: number;
    /** Adds the resources retained by the adapter to each snapshot. */
    resources?: IBabylonTileResourceStatisticsProvider;
}

interface IHeapMemoryInformation {
    jsHeapSizeLimit: number;
    usedJSHeapSize: number;
}

const DEFAULT_PUBLISH_INTERVAL_MILLISECONDS = 250;

/** Formats a byte count with binary units, for example `1.5 KiB`. */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    if (!Number.isFinite(bytes)) return "unbounded";

    const units = ["B", "KiB", "MiB", "GiB"] as const;
    const exponent = Math.min(Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    const precision = value >= 100 || exponent === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[exponent]}`;
}

function heapStatistics(): IJavaScriptHeapStatistics | undefined {
    const memory = (performance as Performance & { memory?: IHeapMemoryInformation }).memory;
    return memory ? { usedBytes: memory.usedJSHeapSize, limitBytes: memory.jsHeapSizeLimit } : undefined;
}

/**
 * Joins renderer-neutral runtime statistics with Babylon render counters.
 *
 * Publication is throttled to keep the monitoring cost predictable. Listeners decide how to display a snapshot.
 */
export class BabylonRuntimeMonitor {
    public readonly enabled: boolean;
    private readonly publishIntervalMilliseconds: number;
    private readonly resources: IBabylonTileResourceStatisticsProvider | undefined;
    private readonly sceneInstrumentation?: SceneInstrumentation;
    private readonly engineInstrumentation?: EngineInstrumentation;
    private readonly listeners = new Set<BabylonMonitorListener>();
    private latestRuntime?: IRuntimeStatisticsSnapshot;
    private nextPublicationAt = 0;
    private startupMilliseconds = 0;
    private unsubscribeRuntime: () => void = () => undefined;

    public constructor(
        private readonly engine: AbstractEngine,
        scene: Scene,
        private readonly runtime: RuntimeInstrumentation,
        options: IBabylonRuntimeMonitorOptions = {},
    ) {
        this.enabled = options.enabled ?? true;
        this.publishIntervalMilliseconds = Math.max(0, options.publishIntervalMilliseconds ?? DEFAULT_PUBLISH_INTERVAL_MILLISECONDS);
        this.resources = options.resources;
        if (!this.enabled) return;

        this.sceneInstrumentation = new SceneInstrumentation(scene);
        this.sceneInstrumentation.captureFrameTime = true;
        this.sceneInstrumentation.captureInterFrameTime = true;
        this.sceneInstrumentation.captureRenderTime = true;
        this.sceneInstrumentation.captureActiveMeshesEvaluationTime = true;
        this.engineInstrumentation = new EngineInstrumentation(this.engine);
        // Requires GPU timer queries; the counter stays at 0 when the browser does not expose them.
        this.engineInstrumentation.captureGPUFrameTime = true;
        this.latestRuntime = this.runtime.snapshot();
        this.unsubscribeRuntime = this.runtime.subscribe((snapshot) => {
            this.latestRuntime = snapshot;
        });
    }

    /** Receives each published snapshot. Returns the unsubscribe function. */
    public subscribe(listener: BabylonMonitorListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Publishes a snapshot at most once per configured interval. Call after `scene.render()`. */
    public update(timestamp = performance.now()): void {
        if (!this.enabled || !this.sceneInstrumentation || timestamp < this.nextPublicationAt) return;
        this.nextPublicationAt = timestamp + this.publishIntervalMilliseconds;

        const scene = this.sceneInstrumentation;
        const gpuNanoseconds = this.engineInstrumentation?.gpuFrameTimeCounter.lastSecAverage ?? 0;
        const frame: IBabylonFrameStatistics = {
            framesPerSecond: this.engine.getFps(),
            drawCalls: Math.round(scene.drawCallsCounter.current),
            frameMilliseconds: scene.frameTimeCounter.lastSecAverage,
            interFrameMilliseconds: scene.interFrameTimeCounter.lastSecAverage,
            renderMilliseconds: scene.renderTimeCounter.lastSecAverage,
            activeMeshesMilliseconds: scene.activeMeshesEvaluationTimeCounter.lastSecAverage,
            ...(gpuNanoseconds > 0 ? { gpuFrameMilliseconds: gpuNanoseconds / 1e6 } : {}),
        };
        const resources = this.resources?.getStatistics();
        const heap = heapStatistics();
        const snapshot: IBabylonMonitorSnapshot = {
            timestamp,
            startupMilliseconds: this.startupMilliseconds,
            runtime: this.latestRuntime ?? this.runtime.snapshot(),
            frame,
            ...(resources ? { resources } : {}),
            ...(heap ? { heap } : {}),
        };
        for (const listener of this.listeners) listener(snapshot);
    }

    public setStartupMilliseconds(value: number): void {
        this.startupMilliseconds = Math.max(0, value);
    }

    public dispose(): void {
        this.unsubscribeRuntime();
        this.unsubscribeRuntime = () => undefined;
        this.listeners.clear();
        this.sceneInstrumentation?.dispose();
        this.engineInstrumentation?.dispose();
    }
}
