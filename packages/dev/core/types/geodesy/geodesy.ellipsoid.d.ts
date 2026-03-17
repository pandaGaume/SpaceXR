export declare class Ellipsoid {
    /** The WGS84 ellipsoid. Unit is meter*/
    static readonly WGS84: Ellipsoid;
    /** The GRS80 ellipsoid. Unit is meter*/
    static readonly GRS80: Ellipsoid;
    /** The GRS67 ellipsoid. Unit is meter*/
    static readonly GRS67: Ellipsoid;
    /** The ANS ellipsoid. Unit is meter*/
    static readonly ANS: Ellipsoid;
    /** The WGS72 ellipsoid. Unit is meter*/
    static readonly WGS72: Ellipsoid;
    /** The Clarke1858 ellipsoid. Unit is meter*/
    static readonly Clarke1858: Ellipsoid;
    /** The Clarke1880 ellipsoid. Unit is meter*/
    static readonly Clarke1880: Ellipsoid;
    static readonly inv3: number;
    static readonly inv6: number;
    static readonly invcbrt2: number;
    static readonly d2r: number;
    static readonly r2d: number;
    /**
     * Build an Ellipsoid from the semi major axis measurement and the inverse flattening.
     *
     * @param {string} name - the name of the ellipsoid
     * @params {number} semiMajor - the semi major value, usually denoted a
     * @param  {number} inverseFlattening - the inverse of the ellipsoid flattening
     * @returns {Ellipsoid} - the new Ellipsoid.
     */
    static FromAAndInverseF(name: string, semiMajor: number, inverseFlattening: number): Ellipsoid;
    /**
     * Build an Ellipsoid from the semi major axis measurement and the flattening.
     *
     * @param {string} name - the name of the ellipsoid
     * @params {number} semiMajor - the semi major value, usually denoted a
     * @param  {number} flattening - the ellipsoid flattening
     * @returns {Ellipsoid} - the new Ellipsoid.
     */
    static FromAAndF(name: string, semiMajor: number, flattening: number): Ellipsoid;
    _name: string;
    _a: number;
    _b: number;
    _aa: number;
    _bb: number;
    _f: number;
    _p1mf: number;
    _invf: number;
    _c: number;
    _e: number;
    _ee: number;
    _invaa: number;
    _aadc: number;
    _bbdcc: number;
    _l: number;
    _p1mee: number;
    _p1meedaa: number;
    _hmin: number;
    _ll4: number;
    _ll: number;
    /**
     * Construct a new Ellipsoid.  This is private to ensure the values are
     * consistent (flattening = 1.0 / inverseFlattening).  Use the methods
     * FromAAndInverseF() and FromAAndF() to create new instances.
     * @param {string} name
     * @param {number} semiMajor
     * @param {number} semiMinor
     * @param {number} flattening
     * @param {number} inverseFlattening
     */
    private constructor();
    get name(): string;
    /**
     * Get semi major axis (meters).
     */
    get semiMajorAxis(): number;
    /**
     * Get semi minor axis (meters).
     */
    get semiMinorAxis(): number;
    /**
     * Get flattening.
     */
    get flattening(): number;
    /**
     * Get inverse flattening.
     */
    get inverseFlattening(): number;
    /**
     * Get linear eccentricity.
     */
    get linearEccentricity(): number;
    /**
     * Get eccentricity.
     */
    get eccentricity(): number;
    /**
     * Get square of eccentricity.
     */
    get sqrEccentricity(): number;
    /**
     * Get precalulated value of 1 - sqrEccentricity.
     */
    get oneMinusSqrEccentricity(): number;
    /**
     * Get Semi-latus rectum.
     */
    get semiLatusRectum(): number;
    /**
     *
     * @param other test the equality with another ellipsoid
     * @returns true if the semiMajorAxis and semiMinorAxis are equals. false otherwise.
     */
    isEquals(other: Ellipsoid): boolean;
    /**
     * Clone this ellipsoid, providing an optional scale to do so.
     * This optional scale is very usefull when want to work with ECEF within the limitation
     * of dedicated platform floating point resolution.
     * @param name
     * @param scale
     * @returns
     */
    clone(name: string, scale?: number): Ellipsoid;
    radiusAtLatitude(phiRad: number): number;
    radiusAtPosition(x: number, y: number, z: number): number;
}
