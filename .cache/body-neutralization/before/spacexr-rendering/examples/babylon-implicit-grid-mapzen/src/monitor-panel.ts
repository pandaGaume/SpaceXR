import {
    formatBytes,
    type IBabylonMonitorSnapshot,
} from "@spacexr/3d-tiles-babylon";

export interface IMonitorPanelElements {
    tiles: HTMLElement;
    memory: HTMLElement;
    cleanup: HTMLElement;
    renderer: HTMLElement;
    frame: HTMLElement;
}

export interface IBabylonBenchmarkSnapshot {
    renderer: "babylonjs";
    startupMilliseconds: number;
    framesPerSecond: number;
    drawCalls: number;
    /** Babylon frame and inter-frame times, averaged over the last second, in milliseconds. */
    frameMilliseconds: number;
    interFrameMilliseconds: number;
    renderMilliseconds: number;
    gpuFrameMilliseconds?: number;
    selectedTiles: number;
    readyContents: number;
    cachedContents: number;
    retainedMeshes: number;
    presentedMeshes: number;
    cpuBytes: number;
    gpuBytes: number;
    jsHeapBytes?: number;
}

declare global {
    interface Window {
        __SPACEXR_BENCHMARK__?: IBabylonBenchmarkSnapshot;
    }
}

export function clearMonitorPanel(elements: IMonitorPanelElements): void {
    elements.tiles.textContent = "Monitoring disabled";
    elements.memory.textContent = "";
    elements.cleanup.textContent = "";
    elements.renderer.textContent = "";
    elements.frame.textContent = "";
}

/**
 * Displays a monitor snapshot in the overlay and publishes it as
 * `window.__SPACEXR_BENCHMARK__` for automated measurements.
 */
export function renderMonitorPanel(
    elements: IMonitorPanelElements,
    snapshot: IBabylonMonitorSnapshot,
): void {
    const { runtime, frame, heap } = snapshot;
    const resources = snapshot.resources ?? {
        handles: 0,
        presented: 0,
        created: 0,
        released: 0,
        cpuBytes: 0,
        gpuBytes: 0,
    };
    const heapDescription = heap
        ? `${formatBytes(heap.usedBytes)}/${formatBytes(heap.limitBytes)}`
        : "unavailable";

    elements.tiles.textContent =
        `Tiles ${runtime.nodes.selected}/${runtime.nodes.total} selected` +
        ` | ${runtime.contents.ready} ready` +
        ` | ${runtime.contents.cached}/${runtime.cache.limits.maxContentEntries} cached` +
        ` | ${runtime.nodes.total}/${runtime.cache.limits.maxMaterializedTiles} nodes` +
        ` | ${runtime.pendingLoads} pending` +
        ` | ${runtime.nodes.unbalanced} unbalanced`;
    elements.memory.textContent =
        `Memory cache CPU ${formatBytes(runtime.contents.cpuBytes)}/${formatBytes(runtime.cache.limits.maxContentCpuBytes)}` +
        ` | GPU ${formatBytes(runtime.contents.gpuBytes)}/${formatBytes(runtime.cache.limits.maxContentGpuBytes)}` +
        ` | live meshes CPU ${formatBytes(resources.cpuBytes)} / GPU ${formatBytes(resources.gpuBytes)}` +
        ` | subtrees ${formatBytes(runtime.subtrees.bytes)}/${formatBytes(runtime.cache.limits.maxSubtreeBytes)}` +
        ` | JS heap ${heapDescription}`;
    elements.cleanup.textContent =
        `Cleanup ${runtime.cache.contentEvictions} contents` +
        ` | ${runtime.cache.subtreeEvictions} subtrees` +
        ` | ${runtime.cache.implicitBranchPrunes} branches` +
        ` | ${runtime.cache.prunedNodes} nodes` +
        ` | released ${formatBytes(runtime.cache.releasedCpuBytes)} CPU / ${formatBytes(runtime.cache.releasedGpuBytes)} GPU`;
    elements.renderer.textContent =
        `Babylon ${frame.framesPerSecond.toFixed(0)} FPS` +
        ` | ${frame.drawCalls} draw calls` +
        ` | ${resources.presented}/${resources.handles} meshes shown` +
        ` | ${resources.created} created / ${resources.released} released` +
        ` | startup ${snapshot.startupMilliseconds.toFixed(0)} ms`;
    elements.frame.textContent =
        `Frame ${frame.frameMilliseconds.toFixed(1)} ms` +
        ` | between frames ${frame.interFrameMilliseconds.toFixed(1)} ms` +
        ` | render ${frame.renderMilliseconds.toFixed(1)} ms` +
        ` | mesh selection ${frame.activeMeshesMilliseconds.toFixed(2)} ms` +
        ` | GPU ${frame.gpuFrameMilliseconds === undefined ? "unavailable" : `${frame.gpuFrameMilliseconds.toFixed(1)} ms`}`;

    const benchmark: IBabylonBenchmarkSnapshot = {
        renderer: "babylonjs",
        startupMilliseconds: snapshot.startupMilliseconds,
        framesPerSecond: frame.framesPerSecond,
        drawCalls: frame.drawCalls,
        frameMilliseconds: frame.frameMilliseconds,
        interFrameMilliseconds: frame.interFrameMilliseconds,
        renderMilliseconds: frame.renderMilliseconds,
        ...(frame.gpuFrameMilliseconds === undefined
            ? {}
            : { gpuFrameMilliseconds: frame.gpuFrameMilliseconds }),
        selectedTiles: runtime.nodes.selected,
        readyContents: runtime.contents.ready,
        cachedContents: runtime.contents.cached,
        retainedMeshes: resources.handles,
        presentedMeshes: resources.presented,
        cpuBytes: resources.cpuBytes,
        gpuBytes: resources.gpuBytes,
    };
    if (heap) benchmark.jsHeapBytes = heap.usedBytes;
    window.__SPACEXR_BENCHMARK__ = benchmark;
}
