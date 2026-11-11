/** How the threshold of new refinements follows the apparent motion of the camera. */
export interface IMotionRefinementOptions {
    /** Factor on the threshold at full speed. */
    maxScale: number;
    /** Apparent speed at and below which the threshold is unchanged. */
    restPixelsPerSecond: number;
    /** Apparent speed at and above which the factor is `maxScale`. */
    fullPixelsPerSecond: number;
    /** Time the speed must stay lower before the factor drops, so that notches of a wheel do not trigger refinements. */
    releaseMilliseconds: number;
}

/** A camera at one instant: a position and two unit axes, in the same frame from one instant to the next. */
export interface ICameraPose {
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
    /** Where it looks. */
    readonly direction: { readonly x: number; readonly y: number; readonly z: number };
    /** The top of its image: looking straight down, a turn of the heading moves this axis alone. */
    readonly up: { readonly x: number; readonly y: number; readonly z: number };
}

/**
 * Apparent speed on screen of terrain at a distance from the camera, in pixels per second: the turn of the view, about
 * any axis, plus the move of the camera seen from that distance. It bounds the speed from above where both add up, as around an orbit,
 * since it serves to compare motion with thresholds, not to place anything.
 *
 * @param focalPixels - Height of the image divided by twice the tangent of half its vertical field of view.
 */
export function apparentPixelsPerSecond(
    previous: ICameraPose,
    current: ICameraPose,
    distance: number,
    focalPixels: number,
    seconds: number,
): number {
    if (seconds <= 0) return 0;
    const length = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z);
    const turn = Math.max(
        length(
            current.direction.x - previous.direction.x,
            current.direction.y - previous.direction.y,
            current.direction.z - previous.direction.z,
        ),
        length(current.up.x - previous.up.x, current.up.y - previous.up.y, current.up.z - previous.up.z),
    );
    const move = length(
        current.position.x - previous.position.x,
        current.position.y - previous.position.y,
        current.position.z - previous.position.z,
    );
    return ((turn + (distance > 0 ? move / distance : 0)) * focalPixels) / seconds;
}

/**
 * Factor on the threshold of new refinements, from the apparent speed of the camera: refining costs loads for detail
 * nobody has the time to see while the view moves fast. It rises at once with the speed, and drops once the speed has
 * stayed lower for a moment, back to 1 when the camera stops.
 */
export class MotionRefinementScale {
    private current = 1;
    private lowerSince: number | undefined;

    public constructor(private readonly options: IMotionRefinementOptions) {
        if (options.maxScale < 1) throw new RangeError("maxScale must be at least 1.");
        if (options.fullPixelsPerSecond <= options.restPixelsPerSecond)
            throw new RangeError("fullPixelsPerSecond must be above restPixelsPerSecond.");
    }

    /** Factor to apply to the threshold of new refinements, at least 1. */
    public get scale(): number {
        return this.current;
    }

    /**
     * Follows the speed of the camera.
     *
     * @returns Whether the factor dropped: the view may need refinements no camera motion will ask for.
     */
    public update(pixelsPerSecond: number, milliseconds: number): boolean {
        const { maxScale, restPixelsPerSecond, fullPixelsPerSecond, releaseMilliseconds } = this.options;
        const position = (pixelsPerSecond - restPixelsPerSecond) / (fullPixelsPerSecond - restPixelsPerSecond);
        const target = 1 + (maxScale - 1) * Math.min(1, Math.max(0, position));
        if (target >= this.current) {
            this.current = target;
            this.lowerSince = undefined;
            return false;
        }
        this.lowerSince ??= milliseconds;
        if (milliseconds - this.lowerSince < releaseMilliseconds) return false;
        this.current = target;
        this.lowerSince = undefined;
        return true;
    }
}
