/**
 * Screen-space error budget: tells a visibility policy how many pixels of
 * geometric error are acceptable at a given camera altitude above the ground.
 *
 * In practice, a single maxSSE constant across all zoom regimes is wrong:
 *  - near the ground, a low threshold (aggressive refinement) is needed to
 *    keep pixel-perfect quality;
 *  - at high altitude, a higher threshold is preferable to avoid refining
 *    thousands of tiles that project to a few pixels each.
 *
 * Implementations receive the camera's altitude above the modelled surface
 * (plane or ellipsoid) and return the max SSE tolerated at that altitude.
 */
export interface IScreenSpaceErrorBudget {
    getMaxSSE(altitude: number): number;
}

/** Altitude-independent budget : the classic "one maxSSE for all". */
export class ConstantSSEBudget implements IScreenSpaceErrorBudget {
    public readonly maxSSE: number;

    public constructor(maxSSE: number) {
        this.maxSSE = maxSSE;
    }

    public getMaxSSE(_altitude: number): number {
        return this.maxSSE;
    }
}

export interface ISSEBudgetStep {
    /** Upper altitude bound (inclusive) for this step. */
    readonly upToAltitude: number;
    /** maxSSE to use when altitude <= upToAltitude and not covered by an earlier step. */
    readonly maxSSE: number;
}

/**
 * Step function in altitude : first step whose `upToAltitude` is >= the current
 * altitude wins, else `aboveLastMaxSSE` is used for altitudes above the last step.
 *
 * Example : `new StepwiseSSEBudget([{upToAltitude: 500, maxSSE: 4}, {upToAltitude: 10_000, maxSSE: 12}], 32)`
 *  - [0, 500]       : 4
 *  - (500, 10_000]  : 12
 *  - (10_000, inf)  : 32
 */
export class StepwiseSSEBudget implements IScreenSpaceErrorBudget {
    public readonly steps: ReadonlyArray<ISSEBudgetStep>;
    public readonly aboveLastMaxSSE: number;

    public constructor(steps: ReadonlyArray<ISSEBudgetStep>, aboveLastMaxSSE: number) {
        this.steps = steps.slice().sort((a, b) => a.upToAltitude - b.upToAltitude);
        this.aboveLastMaxSSE = aboveLastMaxSSE;
    }

    public getMaxSSE(altitude: number): number {
        for (const step of this.steps) {
            if (altitude <= step.upToAltitude) return step.maxSSE;
        }
        return this.aboveLastMaxSSE;
    }
}

export interface ISSEBudgetPoint {
    readonly altitude: number;
    readonly maxSSE: number;
}

/**
 * Piecewise-linear interpolation between anchor points in altitude. Edges are
 * clamped (no extrapolation) : altitudes below the first point use the first
 * value, above the last point use the last value.
 *
 * Example : `new PiecewiseLinearSSEBudget([{altitude: 0, maxSSE: 4}, {altitude: 1_000, maxSSE: 16}, {altitude: 1_000_000, maxSSE: 32}])`
 *  - ground (0)       : 4
 *  - 500 m            : 10 (linear interp between 4 and 16)
 *  - 1 km             : 16
 *  - 500 km           : ~24 (interp between 16 and 32)
 *  - 1 000 km and up  : 32
 */
export class PiecewiseLinearSSEBudget implements IScreenSpaceErrorBudget {
    public readonly points: ReadonlyArray<ISSEBudgetPoint>;

    public constructor(points: ReadonlyArray<ISSEBudgetPoint>) {
        if (points.length === 0) {
            throw new Error("PiecewiseLinearSSEBudget requires at least one point.");
        }
        this.points = points.slice().sort((a, b) => a.altitude - b.altitude);
    }

    public getMaxSSE(altitude: number): number {
        const pts = this.points;
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (altitude <= first.altitude) return first.maxSSE;
        if (altitude >= last.altitude) return last.maxSSE;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            if (altitude >= a.altitude && altitude <= b.altitude) {
                const span = b.altitude - a.altitude;
                const t = span > 0 ? (altitude - a.altitude) / span : 0;
                return a.maxSSE + t * (b.maxSSE - a.maxSSE);
            }
        }
        return last.maxSSE;
    }
}

/**
 * Narrows any value to an IScreenSpaceErrorBudget : forwards an existing budget,
 * wraps a plain number as a ConstantSSEBudget.
 */
export function ResolveSSEBudget(budgetOrNumber: IScreenSpaceErrorBudget | number): IScreenSpaceErrorBudget {
    return typeof budgetOrNumber === "number" ? new ConstantSSEBudget(budgetOrNumber) : budgetOrNumber;
}
