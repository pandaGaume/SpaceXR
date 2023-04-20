export class Ellipsoid {
    /** The WGS84 ellipsoid. Unit is meter*/
    public static readonly WGS84: Ellipsoid = Ellipsoid.FromAAndInverseF("WGS84", 6378137.0, 298.257223563);

    /** The GRS80 ellipsoid. Unit is meter*/
    public static readonly GRS80: Ellipsoid = Ellipsoid.FromAAndInverseF("GRS80", 6378137.0, 298.257222101);

    /** The GRS67 ellipsoid. Unit is meter*/
    public static readonly GRS67: Ellipsoid = Ellipsoid.FromAAndInverseF("GRS67", 6378160.0, 298.25);

    /** The ANS ellipsoid. Unit is meter*/
    public static readonly ANS: Ellipsoid = Ellipsoid.FromAAndInverseF("ANS", 6378160.0, 298.25);

    /** The WGS72 ellipsoid. Unit is meter*/
    public static readonly WGS72: Ellipsoid = Ellipsoid.FromAAndInverseF("WGS72", 6378135.0, 298.26);

    /** The Clarke1858 ellipsoid. Unit is meter*/
    public static readonly Clarke1858: Ellipsoid = Ellipsoid.FromAAndInverseF("Clarke1858", 6378293.645, 294.26);

    /** The Clarke1880 ellipsoid. Unit is meter*/
    public static readonly Clarke1880: Ellipsoid = Ellipsoid.FromAAndInverseF("Clarke1880", 6378249.145, 293.465);

    /**
     * Build an Ellipsoid from the semi major axis measurement and the inverse flattening.
     *
     * @param {string} name - the name of the ellipsoid
     * @params {number} semiMajor - the semi major value, usually denoted a
     * @param  {number} inverseFlattening - the inverse of the ellipsoid flattening
     * @returns {Ellipsoid} - the new Ellipsoid.
     */
    public static FromAAndInverseF(name: string, semiMajor: number, inverseFlattening: number): Ellipsoid {
        const f = 1.0 / inverseFlattening;
        const b = (1.0 - f) * semiMajor;

        return new Ellipsoid(name, semiMajor, b, f, inverseFlattening);
    }

    /**
     * Build an Ellipsoid from the semi major axis measurement and the flattening.
     *
     * @param {string} name - the name of the ellipsoid
     * @params {number} semiMajor - the semi major value, usually denoted a
     * @param  {number} flattening - the ellipsoid flattening
     * @returns {Ellipsoid} - the new Ellipsoid.
     */
    public static FromAAndF(name: string, semiMajor: number, flattening: number): Ellipsoid {
        const inverseF = 1.0 / flattening;
        const b = (1.0 - flattening) * semiMajor;

        return new Ellipsoid(name, semiMajor, b, flattening, inverseF);
    }

    _name: string; // identifier
    _a: number; // input
    _b: number; // a(1-f)
    _aa: number; // a^2
    _bb: number; // b^2
    _f: number; // 1/invf
    _p1mf: number; // 1-f
    _invf: number; // input
    _c: number; // (a^2 - b^2)^(1/2)
    _e: number; // (1 - (b^2/a^2))^(1/2)
    _ee: number; // e^2
    _invaa: number; // 1/(a^2)
    _aadc: number; // (a^2)/c
    _bbdcc: number; // (b^2)/(c^2)
    _l: number; // (e^2)/2
    _p1mee: number; // 1-(e^2)
    _p1meedaa: number; // (1-(e^2))/(a^2)
    _hmin: number; // (e^12)/4
    _ll4: number; // 4*(l^2) = e^4
    _ll: number; // l^2 = (e^4)/4

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
    private constructor(name: string, semiMajor: number, semiMinor: number, flattening: number, inverseFlattening: number) {
        this._name = name;
        this._a = semiMajor;
        this._b = semiMinor;
        this._f = flattening;
        this._p1mf = 1.0 - this._f;
        this._invf = inverseFlattening;

        this._aa = this._a * this._a;
        this._bb = this._b * this._b;

        this._c = Math.sqrt(this._aa - this._bb);
        this._ee = 1 - this._bb / this._aa;
        this._e = Math.sqrt(this._ee);

        this._invaa = 1.0 / this._aa;
        this._aadc = this._aa / this._c;
        this._bbdcc = this._bb / (this._c * this._c);
        this._l = this._ee / 2;
        this._p1mee = 1 - this._ee;
        this._p1meedaa = this._p1mee / this._aa;
        this._hmin = Math.pow(this._e, 12) / 4;
        this._ll = this._l * this._l;
        this._ll4 = this._ll * 4;
    }

    public get name(): string {
        return this._name;
    }

    /**
     * Get semi major axis (meters).
     */
    public get semiMajorAxis(): number {
        return this._a;
    }
    /**
     * Get semi minor axis (meters).
     */
    public get semiMinorAxis(): number {
        return this._b;
    }

    /**
     * Get flattening.
     */
    public get flattening(): number {
        return this._f;
    }

    /**
     * Get inverse flattening.
     */
    public get inverseFlattening(): number {
        return this._invf;
    }

    /**
     * Get linear eccentricity.
     */
    public get linearEccentricity(): number {
        return this._c;
    }

    /**
     * Get eccentricity.
     */
    public get eccentricity(): number {
        return this._e;
    }

    /**
     * Get square of eccentricity.
     */
    public get sqrEccentricity(): number {
        return this._ee;
    }

    /**
     * Get the inverse of square of eccentricity.
     */
    public get oneMinusSqrEccentricity(): number {
        return this._p1mee;
    }
    /**
     * Get Semi-latus rectum.
     */
    public get semiLatusRectum(): number {
        return this._p1mee * this._a;
    }

    /**
     *
     * @param other test the equality with another ellipsoid
     * @returns true if the semiMajorAxis and semiMinorAxis are equals. false otherwise.
     */
    public isEquals(other: Ellipsoid) {
        return other && other._a == this._a && other._b == this._b;
    }

    /**
     * Clone this ellipsoid, providing an optional scale to do so.
     * This optional scale is very usefull when want to work with ECEF within the limitation
     * of dedicated platform floating point resolution.
     * @param name
     * @param scale
     * @returns
     */
    public clone(name: string, scale = 1.0): Ellipsoid {
        return new Ellipsoid(name, this._a * scale, this._b * scale, this._f, this._invf);
    }
}
