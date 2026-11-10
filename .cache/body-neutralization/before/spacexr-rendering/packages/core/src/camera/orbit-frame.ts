import type { ICartesian3, ReferenceSurface } from "@spacexr/tiles";

const dot = (a: ICartesian3, b: ICartesian3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: ICartesian3, b: ICartesian3): ICartesian3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
});
const scaled = (a: ICartesian3, s: number): ICartesian3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const added = (a: ICartesian3, b: ICartesian3): ICartesian3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const normalized = (a: ICartesian3): ICartesian3 => scaled(a, 1 / Math.hypot(a.x, a.y, a.z));

/** Rotates a vector about a unit axis, with the Rodrigues formula. */
function rotated(vector: ICartesian3, axis: ICartesian3, angle: number): ICartesian3 {
    const cosine = Math.cos(angle);
    return added(
        added(scaled(vector, cosine), scaled(cross(axis, vector), Math.sin(angle))),
        scaled(axis, dot(axis, vector) * (1 - cosine)),
    );
}

/** Tangent direction at a point of the surface toward the north, or toward the prime meridian at a pole. */
function northTangent(normal: ICartesian3): ICartesian3 {
    const north = { x: -normal.z * normal.x, y: -normal.z * normal.y, z: 1 - normal.z * normal.z };
    if (Math.hypot(north.x, north.y, north.z) > 1e-9) return normalized(north);
    return normalized({ x: 1 - normal.x * normal.x, y: -normal.x * normal.y, z: -normal.x * normal.z });
}

export interface IOrbitFrameOptions {
    /** Reference surface of the body. */
    surface: ReferenceSurface;
    /** Direction of the point the camera orbits, from the centre of the body. */
    direction: Readonly<ICartesian3>;
    /** Distance from the point to the camera, in metres. */
    radius: number;
    /** Angle from looking straight down to the view, in radians. Defaults to 0. */
    pitchRadians?: number;
    /** Heading from the north, positive toward the east, in radians. At a pole it starts from the prime meridian. Defaults to 0. */
    headingRadians?: number;
    /** Height of the point above the surface, in metres. Defaults to 0. */
    centerHeight?: number;
    /** Defaults to 10 m. */
    radiusMin?: number;
    /** Defaults to 4 times the largest radius of the surface. */
    radiusMax?: number;
    /** Largest pitch, in radians. Defaults to just below the horizontal. */
    pitchMax?: number;
}

/**
 * Pose of a camera orbiting a point of a body, without any pole in its frame.
 *
 * Latitude and heading from the north are undefined at a pole, so the state holds neither: it holds the direction of the
 * point and a tangent direction `forward`, which move together as a rigid body along great circles. The point can cross a
 * pole, and the view keeps turning smoothly. The north is only read to set the initial heading.
 */
export class OrbitFrame {
    public readonly surface: ReferenceSurface;
    public readonly radiusMin: number;
    public readonly radiusMax: number;
    public readonly pitchMax: number;
    /** Height of the point above the surface, in metres. */
    public centerHeight: number;
    private currentDirection: ICartesian3;
    private currentForward: ICartesian3;
    private currentPitch = 0;
    private currentRadius = 0;

    public constructor(options: IOrbitFrameOptions) {
        const { surface } = options;
        this.surface = surface;
        this.radiusMin = options.radiusMin ?? 10;
        this.radiusMax = options.radiusMax ?? 4 * Math.max(...surface.radii);
        this.pitchMax = options.pitchMax ?? Math.PI / 2 - 0.01;
        this.centerHeight = options.centerHeight ?? 0;
        if (!(this.radiusMin > 0) || this.radiusMax < this.radiusMin)
            throw new RangeError("The radius limits must be positive and ordered.");
        const length = Math.hypot(options.direction.x, options.direction.y, options.direction.z);
        if (!(length > 0) || !Number.isFinite(length)) throw new RangeError("The direction of the orbit must be finite and non-zero.");
        this.currentDirection = scaled(options.direction, 1 / length);
        const north = northTangent(this.up);
        this.currentForward = north;
        this.rotateHeading(options.headingRadians ?? 0);
        this.pitch = options.pitchRadians ?? 0;
        this.radius = options.radius;
    }

    /** Unit direction of the point, from the centre of the body. */
    public get direction(): Readonly<ICartesian3> {
        return this.currentDirection;
    }

    /** Unit tangent the view looks toward when tilted. */
    public get forward(): Readonly<ICartesian3> {
        return this.currentForward;
    }

    public get pitch(): number {
        return this.currentPitch;
    }

    /** Clamped to `[0, pitchMax]`. */
    public set pitch(radians: number) {
        this.currentPitch = Math.min(Math.max(radians, 0), this.pitchMax);
    }

    public get radius(): number {
        return this.currentRadius;
    }

    /** Clamped to `[radiusMin, radiusMax]`. */
    public set radius(metres: number) {
        this.currentRadius = Math.min(Math.max(metres, this.radiusMin), this.radiusMax);
    }

    /** The point the camera orbits, in the body-fixed frame. */
    public get center(): ICartesian3 {
        return this.surface.point(this.currentDirection, this.centerHeight);
    }

    /** Normal of the surface at the point. */
    public get up(): ICartesian3 {
        return this.surface.normal(this.surface.point(this.currentDirection));
    }

    /** Unit tangent to the right of `forward`. */
    public get right(): ICartesian3 {
        return cross(this.currentForward, this.up);
    }

    /** Unit direction of the view. */
    public get look(): ICartesian3 {
        return added(scaled(this.up, -Math.cos(this.currentPitch)), scaled(this.currentForward, Math.sin(this.currentPitch)));
    }

    /** Unit up vector of the view. */
    public get viewUp(): ICartesian3 {
        return added(scaled(this.currentForward, Math.cos(this.currentPitch)), scaled(this.up, Math.sin(this.currentPitch)));
    }

    /** Position of the camera, in the body-fixed frame. */
    public get position(): ICartesian3 {
        return added(this.center, scaled(this.look, -this.currentRadius));
    }

    /**
     * Moves the point along the great circle of a tangent displacement, carrying `forward` with it.
     *
     * @param rightRadians - Angle toward `right`.
     * @param forwardRadians - Angle toward `forward`.
     */
    public pan(rightRadians: number, forwardRadians: number): void {
        const angle = Math.hypot(rightRadians, forwardRadians);
        if (angle === 0) return;
        const right = this.right;
        // A rotation about `up x t` moves the point toward the tangent `t`.
        const axis = normalized(added(scaled(this.currentForward, rightRadians), scaled(right, -forwardRadians)));
        this.currentDirection = normalized(rotated(this.currentDirection, axis, angle));
        const forward = rotated(this.currentForward, axis, angle);
        // On a non-spherical surface the normal differs from the direction: keep the tangent in its plane.
        const up = this.up;
        this.currentForward = normalized(added(forward, scaled(up, -dot(forward, up))));
    }

    /** Turns the view about the normal, positive toward `right`. */
    public rotateHeading(radians: number): void {
        const right = this.right;
        this.currentForward = normalized(added(scaled(this.currentForward, Math.cos(radians)), scaled(right, Math.sin(radians))));
    }

    /** Heading from the north, positive toward the east, in radians, or `undefined` at a pole. */
    public get headingRadians(): number | undefined {
        const up = this.up;
        if (Math.hypot(up.x, up.y) < 1e-9) return undefined;
        const north = northTangent(up);
        const east = cross(north, up);
        return Math.atan2(dot(this.currentForward, east), dot(this.currentForward, north));
    }
}
