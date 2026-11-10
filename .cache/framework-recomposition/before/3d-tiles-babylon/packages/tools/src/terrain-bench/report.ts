/** Measures of a path without reading pixels back. CPU, GPU, instances, memory and uploads stay apart. */
export interface IBenchPerformance {
    /** Engine that really ran, which may differ from the one requested. */
    engine: string;
    framesPerSecond: number;
    frameMsMedian?: number;
    frameMsP95?: number;
    frameMsP99?: number;
    /** Tiles that entered and left the cut along the path. */
    cutEntered?: number;
    cutLeft?: number;
    /** Activations cancelled along the path. */
    cancelledLoads?: number;
    /** Refinements of the frames, and what the passes of the balance tried. */
    refines?: number;
    refineAttempts?: number;
    /** Rebuilds of the instances of the GPU engine along the path, and those that gave the cut they had. */
    rebuilds?: number;
    identicalRebuilds?: number;
    terrainCpuMs: number;
    renderCpuMs: number;
    runtimeFrameMs: number;
    gpuMs: number | null;
    instances: number;
    drawCalls: number;
    trianglesPerFrame: number;
    uploadKiBPerFrame: number;
    uploadCallsPerFrame: number;
    gpuMiB: number;
    cpuMiB: number;
    demTiles: number;
    /** Requests to the tile servers, from the opening of the page to the end of the path. */
    tileRequests?: number;
    /** Distinct addresses among them: far fewer means tiles evicted and loaded again. */
    distinctTileRequests?: number;
    /** Hosts of these requests. */
    tileHosts?: string[];
    /** Seconds from the opening of the page until the first view has settled. */
    loadSeconds?: number;
}

/** Tiles shown and hidden along a path: a tile shown again soon after it left went back and forth between levels. */
export interface IBenchLodActivity {
    shown: number;
    hidden: number;
    /** Tiles shown again after they were hidden. */
    returns: number;
    /** The same within 2 seconds. A camera turning one way does not bring back a tile it has just left. */
    quickReturns: number;
    /** Those the camera sees when they return: the others change nothing on screen. */
    quickReturnsInView?: number;
    tilesReturning: number;
    mostReturns?: number;
    mostReturningTile?: string;
    /** What happened to that tile along the path. */
    mostReturningHistory?: string[];
    /** Tiles shown or hidden over 15 runtime frames asked for, the camera still and nothing pending. */
    changesAtRest: number;
    /** Tiles presented once settled. */
    presentedAtRest: number;
    /** Largest and mean error on screen of the visible selected tiles at rest, in pixels. */
    worstErrorAtRest: number;
    meanErrorAtRest: number;
    selectedAtRest: number;
    /** Visible selected tiles above 10 pixels at rest. */
    errorsAbove10AtRest: number;
    /** Mean factor on the threshold of new refinements along the path. */
    meanThresholdScale: number;
}

/** What a path breaks: holes at every frame, and the vertices tiles share on their edges. */
export interface IBenchIntegrity {
    frames: number;
    framesWithHoles: number;
    worstHoles: number;
    edgeChecks: number;
    sharedVerticesPerCheck: number;
    /** Largest gap between shared vertices in the view: it can be seen. */
    worstSharedEdgeMetres: number;
    /** Largest gap anywhere, the tiles of the cover beyond the view included. */
    worstOutOfViewEdgeMetres?: number;
    /** Largest gap in the view once the camera has stopped and the terrain has settled: it lasts. */
    worstSharedEdgeAtRestMetres?: number;
    /** Holes once the terrain has settled. */
    holesAtRest?: number;
    /** Seconds from the end of the path until nothing is pending. */
    settleSeconds?: number;
    lod?: IBenchLodActivity;
    /** Whether the shared edge probe saw a gap of 100 m added to one shared vertex. */
    probeDetects?: boolean;
}

export interface IBenchResult {
    id: string;
    url: string;
    performance?: IBenchPerformance;
    integrity?: IBenchIntegrity;
    errors: string[];
    skipped?: string;
}

export interface IBenchReport {
    /** Commit or label of what was measured. */
    label: string;
    date: string;
    seconds: number;
    results: IBenchResult[];
}

const COLUMNS: ReadonlyArray<readonly [string, (result: IBenchResult) => number | null | undefined, boolean]> = [
    // Name, value, whether lower is better.
    ["fps", (r) => r.performance?.framesPerSecond, false],
    ["p95 ms", (r) => r.performance?.frameMsP95, true],
    ["p99 ms", (r) => r.performance?.frameMsP99, true],
    ["terrain ms", (r) => r.performance?.terrainCpuMs, true],
    ["rebuilds", (r) => r.performance?.rebuilds, true],
    ["identical", (r) => r.performance?.identicalRebuilds, true],
    ["render ms", (r) => r.performance?.renderCpuMs, true],
    ["gpu ms", (r) => r.performance?.gpuMs, true],
    ["instances", (r) => r.performance?.instances, true],
    ["draws", (r) => r.performance?.drawCalls, true],
    ["triangles", (r) => r.performance?.trianglesPerFrame, true],
    ["upload KiB", (r) => r.performance?.uploadKiBPerFrame, true],
    ["gpu MiB", (r) => r.performance?.gpuMiB, true],
    ["cpu MiB", (r) => r.performance?.cpuMiB, true],
    ["requests", (r) => r.performance?.tileRequests, true],
    ["distinct", (r) => r.performance?.distinctTileRequests, true],
    ["load s", (r) => r.performance?.loadSeconds, true],
    ["holes", (r) => r.integrity?.worstHoles, true],
    ["edge m", (r) => r.integrity?.worstSharedEdgeMetres, true],
    ["edge m, all", (r) => r.integrity?.worstOutOfViewEdgeMetres, true],
    ["edge m, rest", (r) => r.integrity?.worstSharedEdgeAtRestMetres, true],
    ["holes, rest", (r) => r.integrity?.holesAtRest, true],
    ["settle s", (r) => r.integrity?.settleSeconds, true],
    ["shown", (r) => r.integrity?.lod?.shown, true],
    ["returns", (r) => r.integrity?.lod?.returns, true],
    ["quick", (r) => r.integrity?.lod?.quickReturns, true],
];

function cell(value: number | null | undefined): string {
    return value === null || value === undefined ? "" : String(value);
}

/** A Markdown table of a report. */
export function formatReport(report: IBenchReport): string {
    const header = `| scenario | ${COLUMNS.map(([name]) => name).join(" | ")} |`;
    const rule = `| --- | ${COLUMNS.map(() => "---").join(" | ")} |`;
    const rows = report.results.map((result) =>
        result.skipped
            ? `| ${result.id} | ${result.skipped} |${" |".repeat(COLUMNS.length - 1)}`
            : `| ${result.id} | ${COLUMNS.map(([, read]) => cell(read(result))).join(" | ")} |`,
    );
    return [`${report.label}, ${report.seconds} s per path`, "", header, rule, ...rows].join("\n");
}

/** A value and its change from a reference, such as `12.4 (-30%)`. */
function change(next: number | null | undefined, previous: number | null | undefined): string {
    if (next === null || next === undefined) return "";
    if (previous === null || previous === undefined) return `${next} (new)`;
    if (previous === next) return `${next} (=)`;
    if (previous === 0) return `${next} (was 0)`;
    const percent = Math.round((100 * (next - previous)) / previous);
    return `${next} (${percent > 0 ? "+" : ""}${percent}%)`;
}

/** A Markdown table of a report against a reference: only scenarios measured in both are compared. */
export function formatComparison(reference: IBenchReport, report: IBenchReport): string {
    const previous = new Map(reference.results.map((result) => [result.id, result]));
    const header = `| scenario | ${COLUMNS.map(([name]) => name).join(" | ")} |`;
    const rule = `| --- | ${COLUMNS.map(() => "---").join(" | ")} |`;
    const rows = report.results
        .filter((result) => !result.skipped)
        .map((result) => {
            const before = previous.get(result.id);
            const comparable = before && !before.skipped && before.performance?.engine === result.performance?.engine;
            return `| ${result.id} | ${COLUMNS.map(([, read]) => change(read(result), comparable ? read(before) : undefined)).join(" | ")} |`;
        });
    return [`${report.label} against ${reference.label}, ${report.seconds} s per path`, "", header, rule, ...rows].join("\n");
}

/** Whether a report shows holes, or shared vertices apart by more than a tolerance. */
export function integrityFailures(report: IBenchReport, toleranceMetres = 0.01): string[] {
    return report.results.flatMap((result) => {
        const integrity = result.integrity;
        // A page that failed draws nothing, and its frames would otherwise read as a clean, fast run.
        const failures: string[] = result.errors.length ? [`${result.id}: ${result.errors.length} page errors`] : [];
        if (result.performance && !result.performance.trianglesPerFrame) failures.push(`${result.id}: nothing drawn`);
        if (!integrity) return failures;
        if (integrity.framesWithHoles > 0)
            failures.push(
                `${result.id}: holes on ${integrity.framesWithHoles} of ${integrity.frames} frames, ${integrity.worstHoles} pixels at worst`,
            );
        if (integrity.worstSharedEdgeMetres > toleranceMetres)
            failures.push(`${result.id}: shared vertices ${integrity.worstSharedEdgeMetres} m apart`);
        if (integrity.probeDetects === false) failures.push(`${result.id}: the shared edge probe missed a gap added on purpose`);
        if (integrity.sharedVerticesPerCheck === 0) failures.push(`${result.id}: no shared vertex compared`);
        if ((integrity.worstSharedEdgeAtRestMetres ?? 0) > toleranceMetres)
            failures.push(`${result.id}: shared vertices ${integrity.worstSharedEdgeAtRestMetres} m apart at rest`);
        if ((integrity.holesAtRest ?? 0) > 0) failures.push(`${result.id}: ${integrity.holesAtRest} hole pixels at rest`);
        return failures;
    });
}
