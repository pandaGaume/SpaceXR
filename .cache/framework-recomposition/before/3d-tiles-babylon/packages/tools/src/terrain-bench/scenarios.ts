/** A camera path, followed in time so that every engine flies the same one. */
export interface IBenchPath {
    /** Heading change, in radians per second. */
    turn?: number;
    /** Zoom in and out between two radii, in metres; `rate` is the logarithm of the factor per second. */
    zoom?: { nearest: number; farthest: number; rate: number };
}

/** Where a scenario looks, and what it validates. */
export interface IBenchView {
    name: string;
    /** URL parameters of the view. */
    query: string;
    path: IBenchPath;
}

/** A view rendered by one engine. */
export interface IBenchScenario extends IBenchView {
    id: string;
    engine: "mesh" | "gpu";
    url: string;
}

export const BENCH_ENGINES = ["mesh", "gpu"] as const;

/** About 15 notches per second of a fast wheel, each a factor 1.105 on the radius. */
const WHEEL_RATE = 1.5;
const TURN_RATE = 0.7;

const ZOOM = (nearest: number): IBenchPath => ({ zoom: { nearest, farthest: 400000, rate: WHEEL_RATE } });
const TURN: IBenchPath = { turn: TURN_RATE };

export const BENCH_VIEWS: readonly IBenchView[] = [
    { name: "mont-blanc", query: "radius=25000&pitch=60", path: TURN },
    { name: "mont-blanc-zoom", query: "radius=400000&pitch=60", path: ZOOM(5000) },
];

/**
 * Every view on every engine.
 *
 * @param base - Address of the example.
 */
export function benchScenarios(base: string): IBenchScenario[] {
    const root = base.replace(/\/+$/, "");
    return BENCH_VIEWS.flatMap((view) =>
        BENCH_ENGINES.map((engine) => ({
            ...view,
            engine,
            id: `${view.name}/${engine}`,
            url: `${root}/?engine=${engine}&solid=1&imagery=none&${view.query}`,
        })),
    );
}
