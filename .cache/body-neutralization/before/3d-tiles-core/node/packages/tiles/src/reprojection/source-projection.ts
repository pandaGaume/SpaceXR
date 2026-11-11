import type { ICartesian3 } from "@spacexr/geodesy";

const DEGREES = 180 / Math.PI;

/** Position in the map of a source: degrees for a geographic source, metres for a projected one. */
export interface IMapPosition {
    x: number;
    y: number;
}

/**
 * Projection of a raster source: from a unit direction of the body-fixed frame to the map of the source, and back. The
 * directions of the cube index go through it, whatever the source. Latitudes are never read from the cube directly: each
 * projection states which latitude its source uses.
 */
export interface ISourceProjection {
    /** Map position of a unit direction. */
    forward(direction: Readonly<ICartesian3>, target?: IMapPosition): IMapPosition;
    /** Unit direction of a map position. */
    inverse(x: number, y: number, target?: ICartesian3): ICartesian3;
    /** Metres on the ground per map unit, at the reference of the map. */
    readonly metresPerUnit: number;
    /** Width of the map along `x` when it wraps around the body, as a global geographic map does. */
    readonly periodX: number | undefined;
}

export interface IGeographicProjectionOptions {
    /** Equatorial radius of the body, in metres. */
    semiMajorAxis: number;
    /**
     * Polar radius of the ellipsoid of the source, for a source with geodetic latitudes such as EPSG:4326. Defaults to
     * `semiMajorAxis`: on a sphere, as in `GCS_Moon_2000`, latitudes are planetocentric.
     */
    semiMinorAxis?: number;
    /** Longitude of the centre of the map, in degrees. Defaults to 0: longitudes run from -180 to 180. */
    centralMeridianDegrees?: number;
}

/** Geographic map, plate carree: `x` is the longitude and `y` the latitude, in degrees. */
export class GeographicProjection implements ISourceProjection {
    public readonly metresPerUnit: number;
    public readonly periodX = 360;
    private readonly squaredRatio: number;
    private readonly centralMeridian: number;

    public constructor(options: IGeographicProjectionOptions) {
        const { semiMajorAxis: a, semiMinorAxis: b = a } = options;
        if (!(a > 0) || !(b > 0)) throw new RangeError("The radii of a projection must be positive.");
        this.metresPerUnit = (Math.PI / 180) * a;
        this.squaredRatio = (a * a) / (b * b);
        this.centralMeridian = options.centralMeridianDegrees ?? 0;
    }

    public forward(direction: Readonly<ICartesian3>, target: IMapPosition = { x: 0, y: 0 }): IMapPosition {
        // tan(geodetic) = (a^2 / b^2) tan(planetocentric); the ratio is 1 on a sphere.
        target.y = Math.atan2(direction.z * this.squaredRatio, Math.hypot(direction.x, direction.y)) * DEGREES;
        target.x = wrapDegrees(Math.atan2(direction.y, direction.x) * DEGREES - this.centralMeridian);
        return target;
    }

    public inverse(x: number, y: number, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        const longitude = (x + this.centralMeridian) / DEGREES;
        const latitude = Math.atan2(Math.sin(y / DEGREES), Math.cos(y / DEGREES) * this.squaredRatio);
        target.x = Math.cos(latitude) * Math.cos(longitude);
        target.y = Math.cos(latitude) * Math.sin(longitude);
        target.z = Math.sin(latitude);
        return target;
    }
}

function wrapDegrees(degrees: number): number {
    if (degrees < -180) return degrees + 360;
    if (degrees >= 180) return degrees - 360;
    return degrees;
}

export interface IPolarStereographicProjectionOptions {
    pole: "north" | "south";
    /** Radius of the sphere of the map, in metres. */
    radius: number;
    /** `central_meridian` of the source, in degrees. Defaults to 0. */
    centralMeridianDegrees?: number;
    /** Defaults to 0. */
    falseEasting?: number;
    /** Defaults to 0. */
    falseNorthing?: number;
}

/**
 * Polar stereographic map on a sphere, true to scale at the pole, in metres. It reads the direction without any latitude
 * or longitude, so the pole is a point like any other:
 *
 * ```text
 * south: x = 2R dy / (1 - dz), y =  2R dx / (1 - dz)
 * north: x = 2R dy / (1 + dz), y = -2R dx / (1 + dz)
 * ```
 *
 * with `dx`, `dy` turned by the central meridian. It matches `Stereographic_South_Pole` of ESRI and EPSG on a sphere.
 */
export class PolarStereographicProjection implements ISourceProjection {
    public readonly metresPerUnit = 1;
    public readonly periodX = undefined;
    private readonly south: boolean;
    private readonly diameter: number;
    private readonly cosine: number;
    private readonly sine: number;
    private readonly falseEasting: number;
    private readonly falseNorthing: number;

    public constructor(options: IPolarStereographicProjectionOptions) {
        if (!(options.radius > 0)) throw new RangeError("The radius of a projection must be positive.");
        this.south = options.pole === "south";
        this.diameter = 2 * options.radius;
        const meridian = (options.centralMeridianDegrees ?? 0) / DEGREES;
        this.cosine = Math.cos(meridian);
        this.sine = Math.sin(meridian);
        this.falseEasting = options.falseEasting ?? 0;
        this.falseNorthing = options.falseNorthing ?? 0;
    }

    public forward(direction: Readonly<ICartesian3>, target: IMapPosition = { x: 0, y: 0 }): IMapPosition {
        const { x, y, z } = direction;
        const dx = x * this.cosine + y * this.sine;
        const dy = y * this.cosine - x * this.sine;
        const scale = this.diameter / (this.south ? 1 - z : 1 + z);
        target.x = dy * scale + this.falseEasting;
        target.y = (this.south ? dx : -dx) * scale + this.falseNorthing;
        return target;
    }

    public inverse(x: number, y: number, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        const mapX = (x - this.falseEasting) / this.diameter;
        const mapY = ((this.south ? y : -y) - (this.south ? this.falseNorthing : -this.falseNorthing)) / this.diameter;
        const squared = mapX * mapX + mapY * mapY;
        const denominator = 1 + squared;
        const along = (2 * mapY) / denominator;
        const across = (2 * mapX) / denominator;
        target.x = along * this.cosine - across * this.sine;
        target.y = along * this.sine + across * this.cosine;
        target.z = ((this.south ? -1 : 1) * (1 - squared)) / denominator;
        return target;
    }
}

export interface IWebMercatorProjectionOptions {
    /** Radius of the map, in metres. Defaults to the WGS84 semi-major axis of EPSG:3857. */
    semiMajorAxis?: number;
    /** Polar radius of the ellipsoid of the latitudes. Defaults to WGS84. */
    semiMinorAxis?: number;
}

/**
 * Web Mercator map, EPSG:3857, in metres: spherical formulas applied to geodetic latitudes. It stops at 85.05 degrees: the
 * positions beyond it fall outside the tile matrices, so another source must cover the caps.
 */
export class WebMercatorProjection implements ISourceProjection {
    public readonly metresPerUnit = 1;
    public readonly periodX: number;
    private readonly radius: number;
    private readonly squaredRatio: number;

    public constructor(options: IWebMercatorProjectionOptions = {}) {
        this.radius = options.semiMajorAxis ?? 6378137;
        const b = options.semiMinorAxis ?? 6356752.314245179;
        this.squaredRatio = (this.radius * this.radius) / (b * b);
        this.periodX = 2 * Math.PI * this.radius;
    }

    public forward(direction: Readonly<ICartesian3>, target: IMapPosition = { x: 0, y: 0 }): IMapPosition {
        const latitude = Math.atan2(direction.z * this.squaredRatio, Math.hypot(direction.x, direction.y));
        target.x = this.radius * Math.atan2(direction.y, direction.x);
        // Infinite at the poles: those positions fall outside every tile matrix.
        target.y = this.radius * Math.log(Math.tan(Math.PI / 4 + latitude / 2));
        return target;
    }

    public inverse(x: number, y: number, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        const longitude = x / this.radius;
        const geodetic = 2 * Math.atan(Math.exp(y / this.radius)) - Math.PI / 2;
        const latitude = Math.atan2(Math.sin(geodetic), Math.cos(geodetic) * this.squaredRatio);
        target.x = Math.cos(latitude) * Math.cos(longitude);
        target.y = Math.cos(latitude) * Math.sin(longitude);
        target.z = Math.sin(latitude);
        return target;
    }
}

/** Longitude and geodetic latitude of a unit direction on a biaxial ellipsoid, in degrees, for the sources that use them. */
export function geodeticOfDirection(direction: Readonly<ICartesian3>, semiMajorAxis: number, semiMinorAxis: number): { latitude: number; longitude: number } {
    const ratio = (semiMajorAxis * semiMajorAxis) / (semiMinorAxis * semiMinorAxis);
    return {
        latitude: Math.atan2(direction.z * ratio, Math.hypot(direction.x, direction.y)) * DEGREES,
        longitude: Math.atan2(direction.y, direction.x) * DEGREES,
    };
}
