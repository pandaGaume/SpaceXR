var SPACEXR_SPACE;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dist/Mechanics/index.js"
/*!*********************************!*\
  !*** ./dist/Mechanics/index.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CelestialTracker: () => (/* reexport safe */ _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__.CelestialTracker),
/* harmony export */   EquatorialVector: () => (/* reexport safe */ _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__.EquatorialVector),
/* harmony export */   HorizonVector: () => (/* reexport safe */ _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__.HorizonVector),
/* harmony export */   JulianDate: () => (/* reexport safe */ _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__.JulianDate),
/* harmony export */   KeplerOrbitBase: () => (/* reexport safe */ _space_kepler__WEBPACK_IMPORTED_MODULE_0__.KeplerOrbitBase),
/* harmony export */   MoonState: () => (/* reexport safe */ _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__.MoonState),
/* harmony export */   SunTrajectoryConfig: () => (/* reexport safe */ _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__.SunTrajectoryConfig)
/* harmony export */ });
/* harmony import */ var _space_kepler__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.kepler */ "./dist/Mechanics/space.kepler.js");
/* harmony import */ var _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./space.celestialTracker */ "./dist/Mechanics/space.celestialTracker.js");


//# sourceMappingURL=index.js.map

/***/ },

/***/ "./dist/Mechanics/space.celestialTracker.js"
/*!**************************************************!*\
  !*** ./dist/Mechanics/space.celestialTracker.js ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CelestialTracker: () => (/* binding */ CelestialTracker),
/* harmony export */   EquatorialVector: () => (/* binding */ EquatorialVector),
/* harmony export */   HorizonVector: () => (/* binding */ HorizonVector),
/* harmony export */   JulianDate: () => (/* binding */ JulianDate),
/* harmony export */   MoonState: () => (/* binding */ MoonState),
/* harmony export */   SunTrajectoryConfig: () => (/* binding */ SunTrajectoryConfig)
/* harmony export */ });
/* harmony import */ var core_math_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math/math */ "core/math/math.units");
/* harmony import */ var core_math_math__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math_math__WEBPACK_IMPORTED_MODULE_0__);

class HorizonVector {
    constructor(azimuth, altitude) {
        this.azimuth = azimuth;
        this.altitude = altitude;
    }
}
/// Right Ascension (RA): Analogous to longitude on Earth, Right Ascension measures the east-west position of a celestial object.
/// It is expressed in terms of hours, minutes, and seconds, where 24 hours equals a full 360-degree circle.
/// RA is measured eastward along the celestial equator from the vernal equinox.
/// Declination (Dec): Similar to latitude on Earth, Declination measures the north-south position of a celestial object.
/// It is expressed in degrees, where positive values indicate north of the celestial equator and negative values indicate south.
/// The range of declination is from +90 degrees at the celestial north pole to -90 degrees at the celestial south pole.
class EquatorialVector {
    constructor(rightAscension, declination) {
        this.rightAscension = rightAscension;
        this.declination = declination;
    }
}
class MoonState {
    constructor(fraction, phase, angle) {
        this.fraction = fraction;
        this.phase = phase;
        this.angle = angle;
    }
}
class SunTrajectoryConfig {
    constructor(angle, riseName, setName) {
        this.angle = angle;
        this.riseName = riseName;
        this.setName = setName;
    }
}
class JulianDate {
    static JulianCycle(d, lw) {
        return Math.round(d - JulianDate.J0 - lw / (2 * Math.PI));
    }
    static FromDate(date) {
        return new JulianDate(date.valueOf() / JulianDate.DayMs - 0.5 + JulianDate.J1970);
    }
    static ToDate(julian) {
        return new Date((julian + 0.5 - JulianDate.J1970) * JulianDate.DayMs);
    }
    constructor(value) {
        this._value = value;
    }
    get value() {
        return this._value;
    }
    toDate() {
        return new Date((this._value + 0.5 - JulianDate.J1970) * JulianDate.DayMs);
    }
    toDays() {
        return this._value - JulianDate.J2000;
    }
}
JulianDate.DayMs = 1000 * 60 * 60 * 24;
JulianDate.J1970 = 2440588;
JulianDate.J2000 = 2451545;
JulianDate.J0 = 0.0009;
/// CelestialTracker is a collection of functions to calculate the position of the sun and the moon in the sky of the earth
/// based on js lib suncalc.js by Vladimir Agafonkin. https://github.com/mourner/suncalc
class CelestialTracker {
    static _ApproxTransit(Ht, lw, n) {
        return JulianDate.J0 + (Ht + lw) / (2 * Math.PI) + n;
    }
    static _SolarTransitJ(ds, M, L) {
        return JulianDate.J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    }
    static _HourAngle(h, phi, d) {
        return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));
    }
    static _ObserverAngle(height) {
        return (-2.076 * Math.sqrt(height)) / 60;
    }
    // returns set time for the given sun altitude
    static _GetSetJ(h, lw, phi, dec, n, M, L) {
        var w = CelestialTracker._HourAngle(h, phi, dec), a = CelestialTracker._ApproxTransit(w, lw, n);
        return CelestialTracker._SolarTransitJ(a, M, L);
    }
    static Azimuth(H, phi, dec) {
        return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    }
    static Altitude(H, phi, dec) {
        return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    }
    static SiderealTime(d, lw) {
        return core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (280.16 + 360.9856235 * d) - lw;
    }
    static Declination(l, b) {
        return Math.asin(Math.sin(b) * CelestialTracker.EarthObliquity_Cos + Math.sin(l) * CelestialTracker.EarthObliquity_Sin * Math.cos(b));
    }
    static RightAscension(l, b) {
        return Math.atan2(Math.sin(l) * CelestialTracker.EarthObliquity_Cos - Math.tan(b) * CelestialTracker.EarthObliquity_Sin, Math.cos(l));
    }
    static EclipticLongitude(M) {
        const C = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
        const P = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 102.9372;
        return M + C + P + Math.PI;
    }
    static SolarMeanAnomaly(d) {
        return core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (357.5291 + 0.98560028 * d);
    }
    static SunCoords(d) {
        const M = CelestialTracker.SolarMeanAnomaly(d);
        const L = CelestialTracker.EclipticLongitude(M);
        return new EquatorialVector(CelestialTracker.RightAscension(L, 0), CelestialTracker.Declination(L, 0));
    }
    // calculates sun times for a given date, latitude/longitude, and, optionally,
    // the observer height (in meters) relative to the horizon
    static GetSunTimes(date, lat, lng, height) {
        height = height || 0;
        const lw = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * -lng;
        const phi = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * lat;
        const dh = CelestialTracker._ObserverAngle(height);
        const d = JulianDate.FromDate(date).toDays();
        const n = JulianDate.JulianCycle(d, lw);
        const ds = CelestialTracker._ApproxTransit(0, lw, n);
        const M = CelestialTracker.SolarMeanAnomaly(ds);
        const L = CelestialTracker.EclipticLongitude(M);
        const dec = CelestialTracker.Declination(L, 0);
        const Jnoon = CelestialTracker._SolarTransitJ(ds, M, L);
        var result = {
            solarNoon: JulianDate.ToDate(Jnoon),
            nadir: JulianDate.ToDate(Jnoon - 0.5),
        };
        const times = CelestialTracker.SunTrajectories;
        for (let i = 0, len = times.length; i < len; i += 1) {
            const time = times[i];
            const h0 = (time.angle + dh) * core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
            const Jset = CelestialTracker._GetSetJ(h0, lw, phi, dec, n, M, L);
            const Jrise = Jnoon - (Jset - Jnoon);
            result[time.riseName] = JulianDate.ToDate(Jrise);
            result[time.setName] = JulianDate.ToDate(Jset);
        }
        return result;
    }
    static GetSunPosition(date, lat, lon) {
        const lw = -lon * core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const phi = lat * core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const d = JulianDate.FromDate(date).toDays();
        const c = CelestialTracker.SunCoords(d);
        const H = CelestialTracker.SiderealTime(d, lw) - c.rightAscension;
        return new HorizonVector(CelestialTracker.Azimuth(H, phi, c.declination), CelestialTracker.Altitude(H, phi, c.declination));
    }
    // moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas
    static _MoonCoords(d) {
        // geocentric ecliptic coordinates of the moon
        const L = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (218.316 + 13.176396 * d); // ecliptic longitude
        const M = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (134.963 + 13.064993 * d); // mean anomaly
        const F = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (93.272 + 13.22935 * d); // mean distance
        const l = L + core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 6.289 * Math.sin(M); // longitude
        const b = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 5.128 * Math.sin(F); // latitude
        const dt = 385001 - 20905 * Math.cos(M); // distance to the moon in km
        const v = new EquatorialVector(CelestialTracker.RightAscension(l, b), CelestialTracker.Declination(l, b));
        v.distance = dt;
        return v;
    }
    static _AstroRefraction(h) {
        if (h < 0)
            // the following formula works for positive altitudes only.
            h = 0; // if h = -0.08901179 a div/0 would occur.
        // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:
        return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
    }
    static GetMoonPosition(date, lat, lon) {
        const lw = -lon * core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const phi = lat * core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const d = JulianDate.FromDate(date).toDays();
        const c = CelestialTracker._MoonCoords(d);
        const H = CelestialTracker.SiderealTime(d, lw) - c.rightAscension;
        let h = CelestialTracker.Altitude(H, phi, c.declination);
        // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.declination) - Math.sin(c.declination) * Math.cos(H));
        h = h + CelestialTracker._AstroRefraction(h); // altitude correction for refraction
        const v = new HorizonVector(CelestialTracker.Azimuth(H, phi, c.declination), h);
        v.distance = c.distance;
        v.parallacticAngle = pa;
        return v;
    }
    static _HoursLater(date, h) {
        return new Date(date.valueOf() + (h * JulianDate.DayMs) / 24);
    }
}
CelestialTracker.EarthObliquity = core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 23.4397;
CelestialTracker.EarthObliquity_Sin = Math.sin(CelestialTracker.EarthObliquity);
CelestialTracker.EarthObliquity_Cos = Math.cos(CelestialTracker.EarthObliquity);
CelestialTracker.SunTrajectories = [
    new SunTrajectoryConfig(-0.833, "sunrise", "sunset"),
    new SunTrajectoryConfig(-0.3, "sunriseEnd", "sunsetStart"),
    new SunTrajectoryConfig(-6, "dawn", "dusk"),
    new SunTrajectoryConfig(-12, "nauticalDawn", "nauticalDusk"),
    new SunTrajectoryConfig(-18, "nightEnd", "night"),
    new SunTrajectoryConfig(6, "goldenHourEnd", "goldenHour"),
];
// calculations for illumination parameters of the moon,
// based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
// Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
CelestialTracker.GetMoonIllumination = function (date) {
    const d = JulianDate.FromDate(date).toDays();
    const s = CelestialTracker.SunCoords(d);
    const m = CelestialTracker._MoonCoords(d);
    const sdist = 149598000; // distance from Earth to Sun in km
    const phi = Math.acos(Math.sin(s.declination) * Math.sin(m.declination) + Math.cos(s.declination) * Math.cos(m.declination) * Math.cos(s.rightAscension - m.rightAscension));
    const inc = Math.atan2(sdist * Math.sin(phi), m.distance - sdist * Math.cos(phi));
    const angle = Math.atan2(Math.cos(s.declination) * Math.sin(s.rightAscension - m.rightAscension), Math.sin(s.declination) * Math.cos(m.declination) - Math.cos(s.declination) * Math.sin(m.declination) * Math.cos(s.rightAscension - m.rightAscension));
    return new MoonState(1 + Math.cos(inc), 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI, angle);
};
// calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article
CelestialTracker.GetMoonTimes = function (date, lat, lng, inUTC) {
    var t = new Date(date);
    if (inUTC)
        t.setUTCHours(0, 0, 0, 0);
    else
        t.setHours(0, 0, 0, 0);
    const hc = 0.133 * core_math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
    let h0 = CelestialTracker.GetMoonPosition(t, lat, lng).altitude - hc;
    let rise, set, ye;
    // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
    for (var i = 1; i <= 24; i += 2) {
        const h1 = CelestialTracker.GetMoonPosition(CelestialTracker._HoursLater(t, i), lat, lng).altitude - hc;
        const h2 = CelestialTracker.GetMoonPosition(CelestialTracker._HoursLater(t, i + 1), lat, lng).altitude - hc;
        const a = (h0 + h2) / 2 - h1;
        const b = (h2 - h0) / 2;
        const xe = -b / (2 * a);
        ye = (a * xe + b) * xe + h1;
        const d = b * b - 4 * a * h1;
        let roots = 0;
        let x1 = 0;
        let x2 = 0;
        if (d >= 0) {
            const dx = Math.sqrt(d) / (Math.abs(a) * 2);
            x1 = xe - dx;
            x2 = xe + dx;
            if (Math.abs(x1) <= 1)
                roots++;
            if (Math.abs(x2) <= 1)
                roots++;
            if (x1 < -1)
                x1 = x2;
        }
        if (roots === 1) {
            if (h0 < 0)
                rise = i + x1;
            else
                set = i + x1;
        }
        else if (roots === 2) {
            rise = i + (ye < 0 ? x2 : x1);
            set = i + (ye < 0 ? x1 : x2);
        }
        if (rise && set)
            break;
        h0 = h2;
    }
    var result = {};
    if (rise)
        result.rise = CelestialTracker._HoursLater(t, rise);
    if (set)
        result.set = CelestialTracker._HoursLater(t, set);
    if (!rise && !set)
        result[ye && ye > 0 ? "alwaysUp" : "alwaysDown"] = true;
    return result;
};
//# sourceMappingURL=space.celestialTracker.js.map

/***/ },

/***/ "./dist/Mechanics/space.kepler.js"
/*!****************************************!*\
  !*** ./dist/Mechanics/space.kepler.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   KeplerOrbitBase: () => (/* binding */ KeplerOrbitBase)
/* harmony export */ });
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math/math.units */ "core/math/math.units");
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math_math_units__WEBPACK_IMPORTED_MODULE_0__);

class KeplerOrbitBase {
    constructor(body, focus, semiMajorAxis, eccentricity = 0, periapsisTime = 0, inclination, ascendingNodeLongitude, periapsisAngle, period) {
        this._body = body;
        this._focus = focus;
        this._semiMajorAxis = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(semiMajorAxis, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Ly);
        this._eccentricity = eccentricity;
        this._periapsisTime = periapsisTime;
        this._inclination = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(inclination, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d);
        this._ascendingNodeLongitude = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(ascendingNodeLongitude, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d);
        this._periapsisAngle = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(periapsisAngle, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d);
        this._period = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan(period, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan.Units.Yr);
    }
    get body() {
        return this._body;
    }
    get focus() {
        return this._focus;
    }
    get semiMajorAxis() {
        return this._semiMajorAxis;
    }
    get semiMinorAxis() {
        const v = this._semiMajorAxis.value * Math.sqrt(1.0 - this._eccentricity * this._eccentricity);
        return new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(v, this._semiMajorAxis.unit);
    }
    get periapsis() {
        const v = this.semiMajorAxis.value * (1.0 - this._eccentricity);
        return new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(v, this._semiMajorAxis.unit);
    }
    get periapsisTime() {
        return this._periapsisTime;
    }
    get periapsisAngle() {
        return this._periapsisAngle;
    }
    get inclination() {
        return this._inclination;
    }
    get period() {
        return this._period;
    }
    get apoapsis() {
        const v = this.semiMajorAxis.value * (1.0 + this._eccentricity);
        return new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(v, this._semiMajorAxis.unit);
    }
    get meanAngularSpeed() {
        return new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Speed(360.0 / this._period.value);
    }
    /**
     * Kepler's equation cannot be solved algebraically. It can be treated by an iteration methods.
     * One of them is Newton's method, finding roots of f(E) = E - e*sin(E) - M(t)
     * @param meanAnomaly
     * @param decimalPrecision
     */
    getEccentricAnomaly(meanAnomaly, decimalPrecision) {
        const dp = decimalPrecision || KeplerOrbitBase.DefaultDecimalPrecision;
        const K = Math.PI / 180.0;
        let m = meanAnomaly / 360.0;
        m = 2.0 * Math.PI * (m - Math.floor(m));
        let E = this._eccentricity < 0.8 ? m : Math.PI;
        // initialize
        let F = E - this._eccentricity * Math.sin(m) - m;
        // iterations limits.
        const maxIteration = KeplerOrbitBase.DefaultIterationLimit;
        const delta = Math.pow(10, -dp);
        let i = 0;
        while (Math.abs(F) > delta && i++ < maxIteration) {
            E -= F / (1.0 - this._eccentricity * Math.cos(E));
            F = E - this._eccentricity * Math.sin(E) - m;
        }
        E /= K;
        return new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(Math.round(E * Math.pow(10, dp)) / Math.pow(10, dp));
    }
}
KeplerOrbitBase.DefaultDecimalPrecision = 5;
KeplerOrbitBase.DefaultIterationLimit = 30; // be conservative...
//# sourceMappingURL=space.kepler.js.map

/***/ },

/***/ "./dist/space.axialTilt.js"
/*!*********************************!*\
  !*** ./dist/space.axialTilt.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AxialTilt: () => (/* binding */ AxialTilt)
/* harmony export */ });
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math/math.units */ "core/math/math.units");
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math_math_units__WEBPACK_IMPORTED_MODULE_0__);

class AxialTilt {
    constructor(obliquity, period) {
        this._obliquity = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(obliquity, AxialTilt.defaultAngleUnit);
        this._period = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan(period, AxialTilt.defaultPeriodUnit);
    }
    get obliquity() {
        return this._obliquity;
    }
    get period() {
        return this._period;
    }
    get meanAngularSpeed() {
        return 360.0 / this._period.value;
    }
}
AxialTilt.defaultAngleUnit = core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d;
AxialTilt.defaultPeriodUnit = core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan.Units.s;
//# sourceMappingURL=space.axialTilt.js.map

/***/ },

/***/ "./dist/space.bodies.js"
/*!******************************!*\
  !*** ./dist/space.bodies.js ***!
  \******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SolarSystemBodies: () => (/* binding */ SolarSystemBodies)
/* harmony export */ });
/* harmony import */ var core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/geodesy/geodesy.ellipsoid */ "core/math/math.units");
/* harmony import */ var core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _space_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./space.interfaces */ "./dist/space.interfaces.js");


const SolarSystemBodies = {
    Earth: {
        name: "Earth",
        celestialType: _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType.PLANET,
        ellipsoid: core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.WGS84,
        meanRadiusKm: 6371,
        surfaceGravity: 9.807,
    },
    Moon: {
        name: "Moon",
        celestialType: _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType.MOON,
        ellipsoid: core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.FromAAndInverseF("Moon", 1738100, Infinity),
        meanRadiusKm: 1737.4,
        surfaceGravity: 1.622,
    },
    Mars: {
        name: "Mars",
        celestialType: _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType.PLANET,
        ellipsoid: core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.FromAAndInverseF("Mars", 3396190, 169.89),
        meanRadiusKm: 3389.5,
        surfaceGravity: 3.721,
    },
    Mercury: {
        name: "Mercury",
        celestialType: _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType.PLANET,
        ellipsoid: core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.FromAAndInverseF("Mercury", 2439700, Infinity),
        meanRadiusKm: 2439.7,
        surfaceGravity: 3.7,
    },
    Ceres: {
        name: "Ceres",
        celestialType: _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType.ASTEROIDE,
        ellipsoid: core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.FromAAndInverseF("Ceres", 476200, Infinity),
        meanRadiusKm: 476.2,
        surfaceGravity: 0.28,
    },
    Vesta: {
        name: "Vesta",
        celestialType: _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType.ASTEROIDE,
        ellipsoid: core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.FromAAndInverseF("Vesta", 262700, Infinity),
        meanRadiusKm: 262.7,
        surfaceGravity: 0.25,
    },
    Titan: {
        name: "Titan",
        celestialType: _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType.MOON,
        ellipsoid: core_geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.FromAAndInverseF("Titan", 2574730, Infinity),
        meanRadiusKm: 2574.7,
        surfaceGravity: 1.352,
    },
};
//# sourceMappingURL=space.bodies.js.map

/***/ },

/***/ "./dist/space.interfaces.js"
/*!**********************************!*\
  !*** ./dist/space.interfaces.js ***!
  \**********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CelestialNodeType: () => (/* binding */ CelestialNodeType)
/* harmony export */ });
var CelestialNodeType;
(function (CelestialNodeType) {
    CelestialNodeType[CelestialNodeType["HUBBLE_RADIUS"] = 0] = "HUBBLE_RADIUS";
    CelestialNodeType[CelestialNodeType["SUPER_CLUSTER"] = 1] = "SUPER_CLUSTER";
    CelestialNodeType[CelestialNodeType["CLUSTER"] = 2] = "CLUSTER";
    CelestialNodeType[CelestialNodeType["GROUP"] = 3] = "GROUP";
    CelestialNodeType[CelestialNodeType["GALAXY"] = 4] = "GALAXY";
    CelestialNodeType[CelestialNodeType["SYSTEM"] = 5] = "SYSTEM";
    CelestialNodeType[CelestialNodeType["STAR"] = 6] = "STAR";
    CelestialNodeType[CelestialNodeType["PLANET"] = 7] = "PLANET";
    CelestialNodeType[CelestialNodeType["MOON"] = 8] = "MOON";
    CelestialNodeType[CelestialNodeType["ASTEROIDE"] = 9] = "ASTEROIDE";
    CelestialNodeType[CelestialNodeType["COMET"] = 10] = "COMET";
    CelestialNodeType[CelestialNodeType["ARTIFICIAL"] = 11] = "ARTIFICIAL";
    CelestialNodeType[CelestialNodeType["VOID"] = 12] = "VOID";
    CelestialNodeType[CelestialNodeType["BLACK_HOLE"] = 13] = "BLACK_HOLE";
    CelestialNodeType[CelestialNodeType["RING"] = 14] = "RING";
})(CelestialNodeType || (CelestialNodeType = {}));
//# sourceMappingURL=space.interfaces.js.map

/***/ },

/***/ "./dist/space.knownPlaces.moon.js"
/*!****************************************!*\
  !*** ./dist/space.knownPlaces.moon.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MoonKnownPlaces: () => (/* binding */ MoonKnownPlaces)
/* harmony export */ });
/* harmony import */ var core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/geography/geography.position */ "core/math/math.units");
/* harmony import */ var core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Notable locations on the Moon using selenographic coordinates (latitude, longitude).
 * Coordinates follow the IAU convention: positive latitude = north, positive longitude = east.
 */
class MoonKnownPlaces {
}
// ── Apollo Landing Sites ──
MoonKnownPlaces.ApolloLandingSites = {
    Apollo11: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(0.6744, 23.4731), // Sea of Tranquility
    Apollo12: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-3.0128, -23.4219), // Ocean of Storms
    Apollo14: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-3.6453, -17.4714), // Fra Mauro
    Apollo15: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(26.1322, 3.6339), // Hadley–Apennine
    Apollo16: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-8.9734, 15.4986), // Descartes Highlands
    Apollo17: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(20.1908, 30.7653), // Taurus–Littrow
};
// ── Major Craters ──
MoonKnownPlaces.Craters = {
    Tycho: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-43.31, -11.36), // Prominent ray crater
    Copernicus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(9.62, -20.08), // Large impact crater
    Aristarchus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(23.73, -47.49), // Brightest large crater
    Kepler: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(8.12, -38.01), // Ray crater in Oceanus Procellarum
    Plato: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(51.62, -9.38), // Dark-floored crater near Mare Imbrium
    Clavius: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-58.41, -14.05), // One of the largest craters
    Grimaldi: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-5.2, -68.36), // Dark-floored basin
    Theophilus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-11.4, 26.28), // Terraced walls crater
    Eratosthenes: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(14.47, -11.32), // South of Mare Imbrium
    Archimedes: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(29.72, -4.04), // Flooded crater in Mare Imbrium
    Ptolemaeus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-9.21, -1.83), // Large walled plain
    Alphonsus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-13.39, -2.98), // Central peak crater
    Arzachel: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-18.21, -1.88), // Well-preserved crater
    Langrenus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-8.86, 60.97), // Eastern limb crater
    Petavius: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-25.3, 60.4), // Large crater with rille
};
// ── Maria (Lunar Seas) ──
MoonKnownPlaces.Maria = {
    MareTranquillitatis: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(8.5, 31.4), // Sea of Tranquility
    MareSereniatis: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(28.0, 17.5), // Sea of Serenity
    MareImbrium: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(32.8, -15.6), // Sea of Showers
    MareCrisium: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(17.0, 59.1), // Sea of Crises
    MareFecunditatis: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-7.8, 51.3), // Sea of Fertility
    MareNectaris: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-15.2, 35.5), // Sea of Nectar
    MareHumorum: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-24.4, -38.6), // Sea of Moisture
    MareNubium: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-21.3, -16.6), // Sea of Clouds
    OceanusProcellarum: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(18.4, -57.4), // Ocean of Storms
    MareFrigoris: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(56.0, 1.4), // Sea of Cold
    MareMarginis: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(13.3, 86.1), // Sea of the Edge
    MareVaporum: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(13.3, 3.6), // Sea of Vapors
};
// ── Mountains and Ranges ──
MoonKnownPlaces.Mountains = {
    MontesApenninus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(18.9, -3.7), // Apennine Mountains
    MontesAlpes: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(46.4, -0.8), // Lunar Alps
    MontesCaucasus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(38.4, 10.0), // Caucasus Mountains
    MontesJura: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(47.1, -34.0), // Jura Mountains
    MontesCarpatus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(14.5, -24.4), // Carpathian Mountains
    MonsPiton: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(40.6, -1.1), // Isolated peak in Mare Imbrium
    MonsHuygens: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(19.9, -2.9), // Tallest lunar mountain (~5500m)
    MonsHadley: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(26.5, 4.7), // Near Apollo 15 site
    MonsBradley: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(22.0, 1.0), // Apennine range
    MontesRook: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-20.6, -82.5), // Orientale basin ring
};
// ── Rilles and Valleys ──
MoonKnownPlaces.RillesAndValleys = {
    RimaHadley: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(25.0, 3.0), // Sinuous rille, Apollo 15
    VallisSnelius: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-31.1, 56.0), // Linear valley
    VallisAlpina: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(48.5, 3.2), // Alpine Valley cutting through Montes Alpes
    VallisSchroteri: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(26.2, -50.8), // Schröter's Valley, largest sinuous rille
    RimaAriadaeus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(6.4, 14.0), // Linear rille
    RimaHyginus: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(7.8, 6.3), // Rille with central crater
};
// ── Exploration Candidates (Artemis / Future) ──
MoonKnownPlaces.ExplorationCandidates = {
    ShackletonCrater: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-89.67, 0.0), // South pole, permanently shadowed
    MalabertCrater: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(10.15, -20.73), // Potential landing site
    AristarPlateau: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(25.5, -51.0), // Aristarchus Plateau
    GruithuisenDomes: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(36.3, -40.0), // Volcanic domes
    ReinerGamma: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(7.5, -59.0), // Magnetic anomaly swirl
    InaCaldera: new core_geography_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(18.65, 5.3), // Irregular mare patch (recent volcanism?)
};
//# sourceMappingURL=space.knownPlaces.moon.js.map

/***/ },

/***/ "./dist/space.spectralClass.js"
/*!*************************************!*\
  !*** ./dist/space.spectralClass.js ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MorganKeenanClass: () => (/* binding */ MorganKeenanClass),
/* harmony export */   SpectralClass: () => (/* binding */ SpectralClass)
/* harmony export */ });
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math/math.units */ "core/math/math.units");
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math_math_units__WEBPACK_IMPORTED_MODULE_0__);

class MorganKeenanClass {
    static Parse(str) {
        const a = this.pattern.exec(str);
        if (a) {
            const major = a[0];
            const minor = parseFloat(a[1]);
            const lum = (a.length > 2 ? a[2] : undefined);
            return new MorganKeenanClass(major, minor, lum);
        }
        return undefined;
    }
    constructor(major, minor, luminosity) {
        this._major = major;
        this._minor = minor;
        this._lum = luminosity;
    }
    get major() {
        return this._major;
    }
    get minor() {
        return this._minor;
    }
    get luminosity() {
        return this._lum;
    }
    get fullName() {
        return this._major + this._minor + this._lum ? "(" + this._lum + ")" : "";
    }
}
MorganKeenanClass.pattern = /^(O|B|A|F|G|K|M)([0-9](.[0-9])?)((Ia\+|I|II|III|IV|V|sd|D))?$/;
MorganKeenanClass.LuminosityNames = ["Ia+", "I", "II", "III", "IV", "V", "sd", "D"];
/* Most stars are currently classified under the Morgan–Keenan (MK) system using the letters O, B, A, F, G, K, and M,
 * a sequence from the hottest (O type) to the coolest (M type). Each letter class is then subdivided using a numeric
 * digit with 0 being hottest and 9 being coolest (e.g. A8, A9, F0, F1 form a sequence from hotter to cooler).
 * The sequence has been expanded with classes for other stars and star-like objects that do not fit in the classical
 * system, such as class D for white dwarfs and class C for carbon stars.
 * In the MK system, a luminosity class is added to the spectral class using Roman numerals. This is based on the width
 * of certain absorption lines in the star"s spectrum, which vary with the density of the atmosphere and so distinguish
 * giant stars from dwarfs. Luminosity class 0 or Ia+ stars for hypergiants, class I stars for supergiants, class II for
 * bright giants, class III for regular giants, class IV for sub-giants, class V for main-sequence stars, class sd for
 * sub-dwarfs, and class D for white dwarfs. The full spectral class for the Sun is then G2V, indicating a main-sequence
 * star with a temperature around 5,800 K.
 */
class SpectralClass {
    static ClassFromTemperature(temperature) {
        const temp = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(temperature, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k);
        const c = SpectralClass.HarwardClassification;
        for (let i = 0; i !== c.length; i++) {
            const sc = c[i];
            const min = sc.effectiveTemperature.min;
            const max = sc.effectiveTemperature.max;
            if ((!min || min.value <= temp.value) && (!max || max.value > temp.value)) {
                return sc;
            }
        }
        return undefined;
    }
    constructor(name, effectiveTemperature, VegaRelativeColorLabel, chromacityLabel, mass, radius, luminosity, hydrogenLine, fractionOfStars) {
        this.name = name;
        this.effectiveTemperature = effectiveTemperature;
        this.VegaRelativeColorLabel = VegaRelativeColorLabel;
        this.chromacityLabel = chromacityLabel;
        this.mass = mass;
        this.radius = radius;
        this.luminosity = luminosity;
        this.hydrogenLine = hydrogenLine;
        this.fractionOfStars = fractionOfStars;
    }
}
SpectralClass.O = new SpectralClass("O", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(30000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(60000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "blue", "blue", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(16, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(6.6, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(30000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 0.00003);
SpectralClass.B = new SpectralClass("B", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(10000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(30000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "blue white", "deep blue white", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(2.1, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(16, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.8, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(6.6, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(25, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(30000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 0.13);
SpectralClass.A = new SpectralClass("A", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(7500, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(10000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "white", "blue white", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.4, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(2.1, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.4, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.8, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(5, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(25, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "strong", 0.6);
SpectralClass.F = new SpectralClass("F", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(6000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(7500, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "yellow white", "white", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.04, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.4, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.15, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.4, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(1.5, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(5, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "medium", 3);
SpectralClass.G = new SpectralClass("G", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(5200, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(6000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "yellow", "yello white", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.8, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.04, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.96, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.15, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.6, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(1.5, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 7.6);
SpectralClass.K = new SpectralClass("K", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(3700, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(5200, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "orange	pale", "yello orange", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.45, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.8, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.7, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.96, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.08, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.6, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "very weak", 12.1);
SpectralClass.M = new SpectralClass("M", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(2400, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(3700, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "red light", "orange red", new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.08, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.45, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.7, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.8, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "very weak", 76.45);
SpectralClass.HarwardClassificationIndex = {
    O: SpectralClass.O,
    B: SpectralClass.B,
    A: SpectralClass.A,
    F: SpectralClass.F,
    G: SpectralClass.G,
    K: SpectralClass.K,
    M: SpectralClass.M,
};
SpectralClass.HarwardClassification = [SpectralClass.O, SpectralClass.B, SpectralClass.A, SpectralClass.F, SpectralClass.G, SpectralClass.K, SpectralClass.M];
SpectralClass.TemperatureRange = new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(2400, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(60000, core_math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k));
//# sourceMappingURL=space.spectralClass.js.map

/***/ },

/***/ "./dist/space.starColor.js"
/*!*********************************!*\
  !*** ./dist/space.starColor.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ColorValue: () => (/* binding */ ColorValue),
/* harmony export */   StarColor: () => (/* binding */ StarColor)
/* harmony export */ });
/* harmony import */ var _space_spectralClass__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.spectralClass */ "./dist/space.spectralClass.js");
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core/math/math.color */ "core/math/math.units");
/* harmony import */ var core_math_math_units__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_math_math_units__WEBPACK_IMPORTED_MODULE_1__);



class ColorValue {
    constructor(mk, sclass, kelvin, color) {
        this.mk = mk;
        this.sclass = sclass;
        this.kelvin = kelvin;
        this.color = color;
    }
}
/*
 * • The upshot is this: the color of a star depends on its surface temperature.  But a blue star doesn’t emit only blue light,
 *   nor does a red star emit only red light.  They emit visible light of all colors to some degree.  It’s just that their
 *   spectrum peaks at a particular color.
 * • So why are there blue stars, yellow stars, red stars, but no green stars?  As it turns out, there are green stars, that is,
 *   stars that radiate much of their light in the green part of the spectrum.  But the total combination of the full range of
 *   colors of a “green” star appears white to our eyes.  If you pass the color from a whitish star through a prism, you’ll see
 *   all the colors, including green, spread out in a continuum.
 * • Astronomers came to understand that bluer stars are intrinsically brighter because they are more massive than
 *   white or red stars, and more massive stars burn much faster and hotter than less massive stars.  The bluish type-O stars,
 *   for example, are only 30-50 times more massive than yellow-white stars like our sun.  But O stars burn a million times
 *   brighter, so they have far shorter lifetimes.
 *   O and B stars only last a few million years before they die in spectacular supernova explosions, while cooler and less
 *   massive K and M stars burn steadily for billions of years.
 * • Some 88% of stars in the universe seem to be the cooler type K and M.  Only 1 in 3,000,000 stars are type O.
 *   Even middle-weights like our type-G Sun comprise only 8% of all known stars.
 *   This relationship between star mass, luminosity, and color holds only for stars burning hydrogen in the core during the
 *   prime of their lives. For example, young and middle-aged M-type stars are small, faint and long-lived.  But as stars age
 *   and start burning heavier elements in the core, bluish O and B stars, for example, evolve briefly into immensely bright
 *   M-type red stars known as red supergiants. We’ll explain this in later issues.  If it sounds complicated, fear not.
 *   Even astronomy majors wrestle over this for some time before they understand how stars live and evolve.
 *
 * thanks to http://oneminuteastronomer.com/708/star-colors-explained/
 * ---------------------------------------------------------------------
 * Stars radiate light a little like glowing coals in a campfire.  Just as a glowing red-hot coal is cooler than a white-hot coal,
 * for example, so a red star is cooler than a white star, and a white star is cooler than a blue star. This was a major scientific
 * discovery… simply by measuring the color of light coming from a star, and applying a little physics, it was possible to estimate
 * a star’s surface temperature.
 * Like most scientists, astronomers love to classify things.  In the late 19th century, Harvard astronomers developed a system to
 * classify stars not according to color, but by the strength by which hydrogen gas absorbed light at particular wavelengths.
 * The star classes were labeled A to N in order of decreasing hydrogen absorption strength.  After a time, the classes
 * were simplified to O, B, A, F, G, K, and M.  This is the Harvard spectral classification, which is still used today.
 * So what does this have to do with star color?
 * • As astronomers and physicists learned more about atomic structure and the spectra of light from stars,
 *   they discovered the Harvard classification system really described the temperature of a star’s atmosphere.
 *   They discovered the type-O stars are hotter than type-B stars, and type-B stars are hotter than type-A stars, and so on.
 *   But hot stars are blue, and medium-hot stars are white, and cool stars are red.
 * • Here’s a summary of the dominant color and temperatures of the main classes of stars, along with examples of stars that
 *   belong to each class
 * according http://www.vendian.org/mncharity/dir3/starcolor/UnstableURLs/starcolors.html
 */
class StarColor {
    static _buildIndex(ColorTable) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = {};
        for (const l of _space_spectralClass__WEBPACK_IMPORTED_MODULE_0__.MorganKeenanClass.LuminosityNames) {
            o[l] = Array.from(StarColor._SelectByLuminosity(l, ColorTable)).sort((a, b) => a.kelvin - b.kelvin);
        }
        return o;
    }
    static *_SelectByLuminosity(l, table) {
        for (const p of table) {
            const c = _space_spectralClass__WEBPACK_IMPORTED_MODULE_0__.MorganKeenanClass.Parse(p.key);
            if (c && c.luminosity === l) {
                const t = 0.9 - c.minor / 10;
                const sc = _space_spectralClass__WEBPACK_IMPORTED_MODULE_0__.SpectralClass.HarwardClassificationIndex[c.major];
                const { min, delta } = sc.effectiveTemperature;
                const { r, g, b } = p.value;
                yield { mk: c, sclass: sc, kelvin: min.value + delta.value * t, color: new core_math_math_units__WEBPACK_IMPORTED_MODULE_1__.RGBAColor(r, g, b) };
            }
        }
    }
    static _lookup(source, temperature) {
        let low = 0, high = source.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (source[mid].kelvin > temperature)
                low = mid + 1;
            else
                high = mid;
        }
        return low;
    }
    /* use to find the range of matrix items wheres temperature lies.
       return an array of one or two matrix item */
    static _lookupIndexes(luminosity, temperature) {
        const l = StarColor.Matrix[luminosity];
        if (!l || !l.length)
            return [];
        const i = StarColor._lookup(l, temperature);
        const res = [];
        if (i == l.length) {
            res.push(l[i - 1]);
            return res;
        }
        res.push(l[i]);
        if (i > 0) {
            res.push(l[i - 1]);
        }
        return res;
    }
    static lookupRgb(luminosity, temperature) {
        const kelvin = new core_math_math_units__WEBPACK_IMPORTED_MODULE_1__.Temperature(temperature, core_math_math_units__WEBPACK_IMPORTED_MODULE_1__.Temperature.Units.k);
        const i = this._lookupIndexes(luminosity, kelvin.value);
        if (!i || !i.length)
            return new core_math_math_units__WEBPACK_IMPORTED_MODULE_1__.RGBAColor(0, 0, 0);
        if (i.length == 1) {
            return i[0].color;
        }
        const k0 = i[0].kelvin;
        const k1 = i[1].kelvin;
        const dk = k1 - k0;
        const c0 = i[0].color;
        if (dk == 0)
            return c0;
        const c1 = i[1].color;
        const f = (kelvin.value - k0) / dk;
        return c0.interpolateInPlace(c1, f);
    }
}
StarColor.ColorTable = [
    { key: "O9I", value: { x: 0.2507, y: 0.2468, r: 164, g: 185, b: 255, color: "#a4b9ff" } },
    { key: "B0I", value: { x: 0.2498, y: 0.2513, r: 161, g: 189, b: 255, color: "#a1bdff" } },
    { key: "B1I", value: { x: 0.2547, y: 0.2562, r: 168, g: 193, b: 255, color: "#a8c1ff" } },
    { key: "B2I", value: { x: 0.2606, y: 0.2611, r: 177, g: 196, b: 255, color: "#b1c4ff" } },
    { key: "B3I", value: { x: 0.2591, y: 0.2582, r: 175, g: 194, b: 255, color: "#afc2ff" } },
    { key: "B4I", value: { x: 0.2678, y: 0.271, r: 187, g: 203, b: 255, color: "#bbcbff" } },
    { key: "B5I", value: { x: 0.2628, y: 0.2685, r: 179, g: 202, b: 255, color: "#b3caff" } },
    { key: "B6I", value: { x: 0.2711, y: 0.2754, r: 191, g: 207, b: 255, color: "#bfcfff" } },
    { key: "B7I", value: { x: 0.2734, y: 0.2785, r: 195, g: 209, b: 255, color: "#c3d1ff" } },
    { key: "B8I", value: { x: 0.2653, y: 0.274, r: 182, g: 206, b: 255, color: "#b6ceff" } },
    { key: "B9I", value: { x: 0.2797, y: 0.2865, r: 204, g: 216, b: 255, color: "#ccd8ff" } },
    { key: "A0I", value: { x: 0.2683, y: 0.2737, r: 187, g: 206, b: 255, color: "#bbceff" } },
    { key: "A1I", value: { x: 0.2871, y: 0.2955, r: 214, g: 223, b: 255, color: "#d6dfff" } },
    { key: "A2I", value: { x: 0.2768, y: 0.2842, r: 199, g: 214, b: 255, color: "#c7d6ff" } },
    { key: "A5I", value: { x: 0.2925, y: 0.3019, r: 223, g: 229, b: 255, color: "#dfe5ff" } },
    { key: "F0I", value: { x: 0.2789, y: 0.2855, r: 202, g: 215, b: 255, color: "#cad7ff" } },
    { key: "F2I", value: { x: 0.3061, y: 0.3172, r: 244, g: 243, b: 255, color: "#f4f3ff" } },
    { key: "F5I", value: { x: 0.2899, y: 0.2978, r: 219, g: 225, b: 255, color: "#dbe1ff" } },
    { key: "F8I", value: { x: 0.3177, y: 0.3337, r: 255, g: 252, b: 247, color: "#fffcf7" } },
    { key: "G0I", value: { x: 0.3361, y: 0.349, r: 255, g: 239, b: 219, color: "#ffefdb" } },
    { key: "G2I", value: { x: 0.3461, y: 0.3605, r: 255, g: 236, b: 205, color: "#ffeccd" } },
    { key: "G3I", value: { x: 0.3479, y: 0.3566, r: 255, g: 231, b: 203, color: "#ffe7cb" } },
    { key: "G5I", value: { x: 0.3617, y: 0.3769, r: 255, g: 230, b: 183, color: "#ffe6b7" } },
    { key: "G8I", value: { x: 0.3764, y: 0.3833, r: 255, g: 220, b: 167, color: "#ffdca7" } },
    { key: "K0I", value: { x: 0.3659, y: 0.3706, r: 255, g: 221, b: 181, color: "#ffddb5" } },
    { key: "K1I", value: { x: 0.3693, y: 0.373, r: 255, g: 220, b: 177, color: "#ffdcb1" } },
    { key: "K2I", value: { x: 0.4022, y: 0.4058, r: 255, g: 211, b: 135, color: "#ffd387" } },
    { key: "K3I", value: { x: 0.411, y: 0.4074, r: 255, g: 204, b: 128, color: "#ffcc80" } },
    { key: "K4I", value: { x: 0.4195, y: 0.4128, r: 255, g: 201, b: 118, color: "#ffc976" } },
    { key: "K5I", value: { x: 0.3896, y: 0.3863, r: 255, g: 209, b: 154, color: "#ffd19a" } },
    { key: "M0I", value: { x: 0.3994, y: 0.392, r: 255, g: 204, b: 143, color: "#ffcc8f" } },
    { key: "M1I", value: { x: 0.4048, y: 0.3948, r: 255, g: 202, b: 138, color: "#ffca8a" } },
    { key: "M2I", value: { x: 0.4338, y: 0.4178, r: 255, g: 193, b: 104, color: "#ffc168" } },
    { key: "M3I", value: { x: 0.4254, y: 0.4044, r: 255, g: 192, b: 118, color: "#ffc076" } },
    { key: "M4I", value: { x: 0.4402, y: 0.41, r: 255, g: 185, b: 104, color: "#ffb968" } },
    { key: "B2II", value: { x: 0.253, y: 0.2557, r: 165, g: 192, b: 255, color: "#a5c0ff" } },
    { key: "B5II", value: { x: 0.2593, y: 0.2597, r: 175, g: 195, b: 255, color: "#afc3ff" } },
    { key: "F0II", value: { x: 0.2795, y: 0.288, r: 203, g: 217, b: 255, color: "#cbd9ff" } },
    { key: "F2II", value: { x: 0.2966, y: 0.3069, r: 229, g: 233, b: 255, color: "#e5e9ff" } },
    { key: "G5II", value: { x: 0.3471, y: 0.3611, r: 255, g: 235, b: 203, color: "#ffebcb" } },
    { key: "M3II", value: { x: 0.4185, y: 0.412, r: 255, g: 201, b: 119, color: "#ffc977" } },
    { key: "O7III", value: { x: 0.246, y: 0.2363, r: 158, g: 177, b: 255, color: "#9eb1ff" } },
    { key: "O8III", value: { x: 0.2455, y: 0.2373, r: 157, g: 178, b: 255, color: "#9db2ff" } },
    { key: "O9III", value: { x: 0.246, y: 0.2363, r: 158, g: 177, b: 255, color: "#9eb1ff" } },
    { key: "B0III", value: { x: 0.246, y: 0.2363, r: 158, g: 177, b: 255, color: "#9eb1ff" } },
    { key: "B1III", value: { x: 0.246, y: 0.2363, r: 158, g: 177, b: 255, color: "#9eb1ff" } },
    { key: "B2III", value: { x: 0.247, y: 0.2396, r: 159, g: 180, b: 255, color: "#9fb4ff" } },
    { key: "B3III", value: { x: 0.2509, y: 0.2486, r: 163, g: 187, b: 255, color: "#a3bbff" } },
    { key: "B5III", value: { x: 0.2541, y: 0.2514, r: 168, g: 189, b: 255, color: "#a8bdff" } },
    { key: "B7III", value: { x: 0.2562, y: 0.2542, r: 171, g: 191, b: 255, color: "#abbfff" } },
    { key: "B9III", value: { x: 0.2615, y: 0.2608, r: 178, g: 195, b: 255, color: "#b2c3ff" } },
    { key: "A0III", value: { x: 0.2687, y: 0.2729, r: 188, g: 205, b: 255, color: "#bccdff" } },
    { key: "A3III", value: { x: 0.2691, y: 0.2707, r: 189, g: 203, b: 255, color: "#bdcbff" } },
    { key: "A5III", value: { x: 0.2787, y: 0.2858, r: 202, g: 215, b: 255, color: "#cad7ff" } },
    { key: "A6III", value: { x: 0.2837, y: 0.2903, r: 209, g: 219, b: 255, color: "#d1dbff" } },
    { key: "A7III", value: { x: 0.2843, y: 0.2911, r: 210, g: 219, b: 255, color: "#d2dbff" } },
    { key: "A8III", value: { x: 0.2837, y: 0.2903, r: 209, g: 219, b: 255, color: "#d1dbff" } },
    { key: "A9III", value: { x: 0.2837, y: 0.2903, r: 209, g: 219, b: 255, color: "#d1dbff" } },
    { key: "F0III", value: { x: 0.2865, y: 0.2945, r: 213, g: 222, b: 255, color: "#d5deff" } },
    { key: "F2III", value: { x: 0.3041, y: 0.3151, r: 241, g: 241, b: 255, color: "#f1f1ff" } },
    { key: "F4III", value: { x: 0.3043, y: 0.3137, r: 241, g: 240, b: 255, color: "#f1f0ff" } },
    { key: "F5III", value: { x: 0.3048, y: 0.3145, r: 242, g: 240, b: 255, color: "#f2f0ff" } },
    { key: "F6III", value: { x: 0.3043, y: 0.3137, r: 241, g: 240, b: 255, color: "#f1f0ff" } },
    { key: "F7III", value: { x: 0.3043, y: 0.3137, r: 241, g: 240, b: 255, color: "#f1f0ff" } },
    { key: "G0III", value: { x: 0.3268, y: 0.3384, r: 255, g: 242, b: 233, color: "#fff2e9" } },
    { key: "G1III", value: { x: 0.3265, y: 0.338, r: 255, g: 243, b: 233, color: "#fff3e9" } },
    { key: "G2III", value: { x: 0.3265, y: 0.338, r: 255, g: 243, b: 233, color: "#fff3e9" } },
    { key: "G3III", value: { x: 0.3265, y: 0.338, r: 255, g: 243, b: 233, color: "#fff3e9" } },
    { key: "G4III", value: { x: 0.3265, y: 0.338, r: 255, g: 243, b: 233, color: "#fff3e9" } },
    { key: "G5III", value: { x: 0.3421, y: 0.3541, r: 255, g: 236, b: 211, color: "#ffecd3" } },
    { key: "G6III", value: { x: 0.3392, y: 0.3496, r: 255, g: 236, b: 215, color: "#ffecd7" } },
    { key: "G8III", value: { x: 0.3505, y: 0.3613, r: 255, g: 231, b: 199, color: "#ffe7c7" } },
    { key: "G9III", value: { x: 0.3529, y: 0.3643, r: 255, g: 231, b: 196, color: "#ffe7c4" } },
    { key: "K0III", value: { x: 0.358, y: 0.3663, r: 255, g: 227, b: 190, color: "#ffe3be" } },
    { key: "K1III", value: { x: 0.3653, y: 0.3721, r: 255, g: 223, b: 181, color: "#ffdfb5" } },
    { key: "K2III", value: { x: 0.3698, y: 0.376, r: 255, g: 221, b: 175, color: "#ffddaf" } },
    { key: "K3III", value: { x: 0.3776, y: 0.38, r: 255, g: 216, b: 167, color: "#ffd8a7" } },
    { key: "K4III", value: { x: 0.3947, y: 0.3956, r: 255, g: 211, b: 146, color: "#ffd392" } },
    { key: "K5III", value: { x: 0.4034, y: 0.3966, r: 255, g: 204, b: 138, color: "#ffcc8a" } },
    { key: "K7III", value: { x: 0.3989, y: 0.3975, r: 255, g: 208, b: 142, color: "#ffd08e" } },
    { key: "M0III", value: { x: 0.4088, y: 0.4013, r: 255, g: 203, b: 132, color: "#ffcb84" } },
    { key: "M1III", value: { x: 0.4181, y: 0.4085, r: 255, g: 200, b: 121, color: "#ffc879" } },
    { key: "M2III", value: { x: 0.4215, y: 0.4098, r: 255, g: 198, b: 118, color: "#ffc676" } },
    { key: "M3III", value: { x: 0.4192, y: 0.4108, r: 255, g: 200, b: 119, color: "#ffc877" } },
    { key: "M4III", value: { x: 0.4102, y: 0.4091, r: 255, g: 206, b: 127, color: "#ffce7f" } },
    { key: "M5III", value: { x: 0.4171, y: 0.4035, r: 255, g: 197, b: 124, color: "#ffc57c" } },
    { key: "M6III", value: { x: 0.4312, y: 0.3876, r: 255, g: 178, b: 121, color: "#ffb279" } },
    { key: "M7III", value: { x: 0.4591, y: 0.3966, r: 255, g: 165, b: 97, color: "#ffa561" } },
    { key: "M8III", value: { x: 0.4582, y: 0.398, r: 255, g: 167, b: 97, color: "#ffa761" } },
    { key: "M9III", value: { x: 0.3802, y: 0.4084, r: 255, g: 233, b: 154, color: "#ffe99a" } },
    { key: "B1IV", value: { x: 0.2459, y: 0.2397, r: 157, g: 180, b: 255, color: "#9db4ff" } },
    { key: "B2IV", value: { x: 0.2467, y: 0.2388, r: 159, g: 179, b: 255, color: "#9fb3ff" } },
    { key: "B3IV", value: { x: 0.2523, y: 0.2498, r: 166, g: 188, b: 255, color: "#a6bcff" } },
    { key: "B6IV", value: { x: 0.2591, y: 0.2582, r: 175, g: 194, b: 255, color: "#afc2ff" } },
    { key: "B7IV", value: { x: 0.2552, y: 0.2522, r: 170, g: 189, b: 255, color: "#aabdff" } },
    { key: "B9IV", value: { x: 0.2628, y: 0.2629, r: 180, g: 197, b: 255, color: "#b4c5ff" } },
    { key: "A0IV", value: { x: 0.2622, y: 0.2623, r: 179, g: 197, b: 255, color: "#b3c5ff" } },
    { key: "A3IV", value: { x: 0.2698, y: 0.2734, r: 190, g: 205, b: 255, color: "#becdff" } },
    { key: "A4IV", value: { x: 0.2738, y: 0.2793, r: 195, g: 210, b: 255, color: "#c3d2ff" } },
    { key: "A5IV", value: { x: 0.2857, y: 0.2923, r: 212, g: 220, b: 255, color: "#d4dcff" } },
    { key: "A7IV", value: { x: 0.2715, y: 0.2759, r: 192, g: 207, b: 255, color: "#c0cfff" } },
    { key: "A9IV", value: { x: 0.2932, y: 0.2997, r: 224, g: 227, b: 255, color: "#e0e3ff" } },
    { key: "F0IV", value: { x: 0.2893, y: 0.2966, r: 218, g: 224, b: 255, color: "#dae0ff" } },
    { key: "F2IV", value: { x: 0.2951, y: 0.3029, r: 227, g: 230, b: 255, color: "#e3e6ff" } },
    { key: "F3IV", value: { x: 0.2952, y: 0.3036, r: 227, g: 230, b: 255, color: "#e3e6ff" } },
    { key: "F5IV", value: { x: 0.3044, y: 0.3133, r: 241, g: 239, b: 255, color: "#f1efff" } },
    { key: "F7IV", value: { x: 0.304, y: 0.313, r: 240, g: 239, b: 255, color: "#f0efff" } },
    { key: "F8IV", value: { x: 0.3138, y: 0.328, r: 255, g: 252, b: 253, color: "#fffcfd" } },
    { key: "G0IV", value: { x: 0.319, y: 0.3317, r: 255, g: 248, b: 245, color: "#fff8f5" } },
    { key: "G2IV", value: { x: 0.3212, y: 0.3311, r: 255, g: 244, b: 242, color: "#fff4f2" } },
    { key: "G3IV", value: { x: 0.3319, y: 0.3417, r: 255, g: 238, b: 226, color: "#ffeee2" } },
    { key: "G4IV", value: { x: 0.3232, y: 0.3359, r: 255, g: 245, b: 238, color: "#fff5ee" } },
    { key: "G5IV", value: { x: 0.3404, y: 0.3503, r: 255, g: 235, b: 213, color: "#ffebd5" } },
    { key: "G6IV", value: { x: 0.326, y: 0.3359, r: 255, g: 242, b: 234, color: "#fff2ea" } },
    { key: "G7IV", value: { x: 0.3466, y: 0.3551, r: 255, g: 231, b: 205, color: "#ffe7cd" } },
    { key: "G8IV", value: { x: 0.3422, y: 0.351, r: 255, g: 233, b: 211, color: "#ffe9d3" } },
    { key: "K0IV", value: { x: 0.3592, y: 0.3659, r: 255, g: 225, b: 189, color: "#ffe1bd" } },
    { key: "K1IV", value: { x: 0.3743, y: 0.3753, r: 255, g: 216, b: 171, color: "#ffd8ab" } },
    { key: "K2IV", value: { x: 0.3491, y: 0.3565, r: 255, g: 229, b: 202, color: "#ffe5ca" } },
    { key: "K3IV", value: { x: 0.3764, y: 0.3821, r: 255, g: 219, b: 167, color: "#ffdba7" } },
    { key: "O5V", value: { x: 0.2436, y: 0.2343, r: 155, g: 176, b: 255, color: "#9bb0ff" } },
    { key: "O6V", value: { x: 0.2492, y: 0.2445, r: 162, g: 184, b: 255, color: "#a2b8ff" } },
    { key: "O7V", value: { x: 0.2451, y: 0.2351, r: 157, g: 177, b: 255, color: "#9db1ff" } },
    { key: "O8V", value: { x: 0.2451, y: 0.2351, r: 157, g: 177, b: 255, color: "#9db1ff" } },
    { key: "O9V", value: { x: 0.2437, y: 0.2366, r: 154, g: 178, b: 255, color: "#9ab2ff" } },
    { key: "O9.5V", value: { x: 0.251, y: 0.2472, r: 164, g: 186, b: 255, color: "#a4baff" } },
    { key: "B0V", value: { x: 0.2448, y: 0.2362, r: 156, g: 178, b: 255, color: "#9cb2ff" } },
    { key: "B0.5V", value: { x: 0.253, y: 0.2501, r: 167, g: 188, b: 255, color: "#a7bcff" } },
    { key: "B1V", value: { x: 0.2481, y: 0.2424, r: 160, g: 182, b: 255, color: "#a0b6ff" } },
    { key: "B2V", value: { x: 0.2474, y: 0.2395, r: 160, g: 180, b: 255, color: "#a0b4ff" } },
    { key: "B3V", value: { x: 0.2517, y: 0.2472, r: 165, g: 185, b: 255, color: "#a5b9ff" } },
    { key: "B4V", value: { x: 0.2506, y: 0.2453, r: 164, g: 184, b: 255, color: "#a4b8ff" } },
    { key: "B5V", value: { x: 0.2559, y: 0.2546, r: 170, g: 191, b: 255, color: "#aabfff" } },
    { key: "B6V", value: { x: 0.2563, y: 0.2522, r: 172, g: 189, b: 255, color: "#acbdff" } },
    { key: "B7V", value: { x: 0.2578, y: 0.2555, r: 173, g: 191, b: 255, color: "#adbfff" } },
    { key: "B8V", value: { x: 0.2604, y: 0.2603, r: 177, g: 195, b: 255, color: "#b1c3ff" } },
    { key: "B9V", value: { x: 0.2639, y: 0.2642, r: 181, g: 198, b: 255, color: "#b5c6ff" } },
    { key: "A0V", value: { x: 0.2668, y: 0.2686, r: 185, g: 201, b: 255, color: "#b9c9ff" } },
    { key: "A1V", value: { x: 0.2635, y: 0.265, r: 181, g: 199, b: 255, color: "#b5c7ff" } },
    { key: "A2V", value: { x: 0.2677, y: 0.2701, r: 187, g: 203, b: 255, color: "#bbcbff" } },
    { key: "A3V", value: { x: 0.2706, y: 0.2752, r: 191, g: 207, b: 255, color: "#bfcfff" } },
    { key: "A5V", value: { x: 0.2786, y: 0.2858, r: 202, g: 215, b: 255, color: "#cad7ff" } },
    { key: "A6V", value: { x: 0.2765, y: 0.2825, r: 199, g: 212, b: 255, color: "#c7d4ff" } },
    { key: "A7V", value: { x: 0.2771, y: 0.283, r: 200, g: 213, b: 255, color: "#c8d5ff" } },
    { key: "A8V", value: { x: 0.2864, y: 0.2943, r: 213, g: 222, b: 255, color: "#d5deff" } },
    { key: "A9V", value: { x: 0.2901, y: 0.2971, r: 219, g: 224, b: 255, color: "#dbe0ff" } },
    { key: "F0V", value: { x: 0.2932, y: 0.3018, r: 224, g: 229, b: 255, color: "#e0e5ff" } },
    { key: "F2V", value: { x: 0.3012, y: 0.3125, r: 236, g: 239, b: 255, color: "#ecefff" } },
    { key: "F4V", value: { x: 0.2935, y: 0.2993, r: 224, g: 226, b: 255, color: "#e0e2ff" } },
    { key: "F5V", value: { x: 0.3088, y: 0.3209, r: 248, g: 247, b: 255, color: "#f8f7ff" } },
    { key: "F6V", value: { x: 0.306, y: 0.3154, r: 244, g: 241, b: 255, color: "#f4f1ff" } },
    { key: "F7V", value: { x: 0.3075, y: 0.3168, r: 246, g: 243, b: 255, color: "#f6f3ff" } },
    { key: "F8V", value: { x: 0.3147, y: 0.324, r: 255, g: 247, b: 252, color: "#fff7fc" } },
    { key: "F9V", value: { x: 0.3149, y: 0.3247, r: 255, g: 247, b: 252, color: "#fff7fc" } },
    { key: "G0V", value: { x: 0.3149, y: 0.3257, r: 255, g: 248, b: 252, color: "#fff8fc" } },
    { key: "G1V", value: { x: 0.3172, y: 0.3278, r: 255, g: 247, b: 248, color: "#fff7f8" } },
    { key: "G2V", value: { x: 0.3211, y: 0.3323, r: 255, g: 245, b: 242, color: "#fff5f2" } },
    { key: "G4V", value: { x: 0.3293, y: 0.3403, r: 255, g: 241, b: 229, color: "#fff1e5" } },
    { key: "G5V", value: { x: 0.326, y: 0.3382, r: 255, g: 244, b: 234, color: "#fff4ea" } },
    { key: "G6V", value: { x: 0.3257, y: 0.338, r: 255, g: 244, b: 235, color: "#fff4eb" } },
    { key: "G7V", value: { x: 0.3257, y: 0.338, r: 255, g: 244, b: 235, color: "#fff4eb" } },
    { key: "G8V", value: { x: 0.3346, y: 0.3445, r: 255, g: 237, b: 222, color: "#ffedde" } },
    { key: "G9V", value: { x: 0.3352, y: 0.3469, r: 255, g: 239, b: 221, color: "#ffefdd" } },
    { key: "K0V", value: { x: 0.3352, y: 0.3458, r: 255, g: 238, b: 221, color: "#ffeedd" } },
    { key: "K1V", value: { x: 0.3603, y: 0.3664, r: 255, g: 224, b: 188, color: "#ffe0bc" } },
    { key: "K2V", value: { x: 0.3535, y: 0.3597, r: 255, g: 227, b: 196, color: "#ffe3c4" } },
    { key: "K3V", value: { x: 0.3555, y: 0.3571, r: 255, g: 222, b: 195, color: "#ffdec3" } },
    { key: "K4V", value: { x: 0.367, y: 0.3645, r: 255, g: 216, b: 181, color: "#ffd8b5" } },
    { key: "K5V", value: { x: 0.3836, y: 0.3798, r: 255, g: 210, b: 161, color: "#ffd2a1" } },
    { key: "K7V", value: { x: 0.403, y: 0.3875, r: 255, g: 199, b: 142, color: "#ffc78e" } },
    { key: "K8V", value: { x: 0.3746, y: 0.3661, r: 255, g: 209, b: 174, color: "#ffd1ae" } },
    { key: "M0V", value: { x: 0.4073, y: 0.3876, r: 255, g: 195, b: 139, color: "#ffc38b" } },
    { key: "M1V", value: { x: 0.4011, y: 0.3927, r: 255, g: 204, b: 142, color: "#ffcc8e" } },
    { key: "M2V", value: { x: 0.413, y: 0.3958, r: 255, g: 196, b: 131, color: "#ffc483" } },
    { key: "M3V", value: { x: 0.4089, y: 0.4075, r: 255, g: 206, b: 129, color: "#ffce81" } },
    { key: "M4V", value: { x: 0.4137, y: 0.4043, r: 255, g: 201, b: 127, color: "#ffc97f" } },
    { key: "M5V", value: { x: 0.4227, y: 0.4218, r: 255, g: 204, b: 111, color: "#ffcc6f" } },
    { key: "M6V", value: { x: 0.4271, y: 0.4123, r: 255, g: 195, b: 112, color: "#ffc370" } },
    { key: "M8V", value: { x: 0.4276, y: 0.4176, r: 255, g: 198, b: 109, color: "#ffc66d" } },
];
/* this is where we prepare the static matrix (Space.StarColorFactory.Matrix) to efficient color lookup. */
StarColor.Matrix = StarColor._buildIndex(StarColor.ColorTable);
//# sourceMappingURL=space.starColor.js.map

/***/ },

/***/ "./dist/vendors/index.js"
/*!*******************************!*\
  !*** ./dist/vendors/index.js ***!
  \*******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Mars: () => (/* reexport safe */ _space_vendor_mars__WEBPACK_IMPORTED_MODULE_1__.Mars),
/* harmony export */   MarsUrlBuilder: () => (/* reexport safe */ _space_vendor_mars__WEBPACK_IMPORTED_MODULE_1__.MarsUrlBuilder),
/* harmony export */   Mercury: () => (/* reexport safe */ _space_vendor_mercury__WEBPACK_IMPORTED_MODULE_2__.Mercury),
/* harmony export */   MercuryUrlBuilder: () => (/* reexport safe */ _space_vendor_mercury__WEBPACK_IMPORTED_MODULE_2__.MercuryUrlBuilder),
/* harmony export */   Moon: () => (/* reexport safe */ _space_vendor_moon__WEBPACK_IMPORTED_MODULE_0__.Moon),
/* harmony export */   MoonUrlBuilder: () => (/* reexport safe */ _space_vendor_moon__WEBPACK_IMPORTED_MODULE_0__.MoonUrlBuilder)
/* harmony export */ });
/* harmony import */ var _space_vendor_moon__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.vendor.moon */ "./dist/vendors/space.vendor.moon.js");
/* harmony import */ var _space_vendor_mars__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./space.vendor.mars */ "./dist/vendors/space.vendor.mars.js");
/* harmony import */ var _space_vendor_mercury__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./space.vendor.mercury */ "./dist/vendors/space.vendor.mercury.js");



//# sourceMappingURL=index.js.map

/***/ },

/***/ "./dist/vendors/space.vendor.mars.js"
/*!*******************************************!*\
  !*** ./dist/vendors/space.vendor.mars.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Mars: () => (/* binding */ Mars),
/* harmony export */   MarsUrlBuilder: () => (/* binding */ MarsUrlBuilder)
/* harmony export */ });
/* harmony import */ var core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/dem/dem.tileclient */ "core/math/math.units");
/* harmony import */ var core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! .. */ "./dist/space.bodies.js");









class MarsUrlBuilder extends core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
    constructor(host, path, tms = false) {
        super();
        this.withSecure(true).withHost(host).withPath(path).withExtension("png");
        if (tms) {
            this.withTMSY(true);
        }
    }
}
/** Carto CDN — supports CORS */
MarsUrlBuilder.Basemap = new MarsUrlBuilder("cartocdn-gusc.global.ssl.fastly.net", "opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.{extension}");
/** Raw S3 — no CORS headers, TMS Y convention */
MarsUrlBuilder.MOLAColor = new MarsUrlBuilder("s3-eu-west-1.amazonaws.com", "whereonmars.cartodb.net/mola-color/{z}/{x}/{y}.{extension}", true);
/** Raw S3 — no CORS headers, TMS Y convention */
MarsUrlBuilder.MOLAGray = new MarsUrlBuilder("s3-eu-west-1.amazonaws.com", "whereonmars.cartodb.net/mola-gray/{z}/{x}/{y}.{extension}", true);
/** Raw S3 — no CORS headers, TMS Y convention */
MarsUrlBuilder.Surface = new MarsUrlBuilder("s3-eu-west-1.amazonaws.com", "whereonmars.cartodb.net/celestia_mars-shaded-16k_global/{z}/{x}/{y}.{extension}", true);
class Mars {
    static BasemapClient(options) {
        // Carto CDN serves CORS headers — use standard fetch-based client
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.TileWebClient(`${Mars.KEY}_basemap`, MarsUrlBuilder.Basemap, new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ImageTileCodec(), Mars.Metrics, options);
    }
    static MOLAColorClient(options) {
        // Raw S3, no CORS — use <img> loading
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ImageTileClient(`${Mars.KEY}_mola_color`, MarsUrlBuilder.MOLAColor, Mars.Metrics, options);
    }
    static MOLAGrayClient(options) {
        // Raw S3, no CORS — use <img> loading
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ImageTileClient(`${Mars.KEY}_mola_gray`, MarsUrlBuilder.MOLAGray, Mars.Metrics, options);
    }
    static SurfaceClient(options) {
        // Raw S3, no CORS — use <img> loading
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ImageTileClient(`${Mars.KEY}_surface`, MarsUrlBuilder.Surface, Mars.Metrics, options);
    }
    /**
     * Returns a tile client that fetches MOLA DEM elevations as Float32Array.
     * Each pixel is decoded from ArcGIS grayscale (0–255) to meters using the MOLA elevation range.
     */
    static ElevationsClient(options) {
        const urlBuilder = new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ArcGISImageServerUrlBuilder(Mars.MOLA_DEM_URL, ___WEBPACK_IMPORTED_MODULE_1__.SolarSystemBodies.Mars.ellipsoid.semiMajorAxis);
        const decoder = new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ArcGISGrayscaleElevationDecoder(Mars.MOLA_MIN, Mars.MOLA_MAX);
        const o = (0,core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.isFilter)(options?.filter) ? new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.Float32TileCodecOptions({ filter: options?.filter }) : undefined;
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.TileWebClient(`${Mars.KEY}_mola_dem`, urlBuilder, new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.Float32TileCodec(decoder, o), Mars.Metrics, options);
    }
    /**
     * Returns a DEM tile client combining MOLA elevations with computed normals.
     * Compatible with the existing DemTileWebClient pipeline.
     */
    static DemClient(options) {
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.DemTileWebClient(`${Mars.KEY}_dem`, Mars.ElevationsClient(options));
    }
}
Mars.KEY = "mars";
Mars.MaxLevelOfDetail = 7;
Mars.Metrics = new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.EPSG3857({ maxLOD: Mars.MaxLevelOfDetail }, ___WEBPACK_IMPORTED_MODULE_1__.SolarSystemBodies.Mars.ellipsoid);
Mars.Attribution = "OpenPlanetary / USGS / NASA";
// MOLA DEM elevation range (meters)
Mars.MOLA_MIN = -8201;
Mars.MOLA_MAX = 21241;
/** NASA Trek ArcGIS ImageServer — MOLA DEM (128/64 ppd merge) */
Mars.MOLA_DEM_URL = "https://trek.nasa.gov/mars/trekarcgis/rest/services/mola128_mola64_merge_90Nto90S_SimpleC_clon0/ImageServer/exportImage";
//# sourceMappingURL=space.vendor.mars.js.map

/***/ },

/***/ "./dist/vendors/space.vendor.mercury.js"
/*!**********************************************!*\
  !*** ./dist/vendors/space.vendor.mercury.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Mercury: () => (/* binding */ Mercury),
/* harmony export */   MercuryUrlBuilder: () => (/* binding */ MercuryUrlBuilder)
/* harmony export */ });
/* harmony import */ var core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/tiles/tiles.url.web */ "core/math/math.units");
/* harmony import */ var core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! .. */ "./dist/space.bodies.js");





class MercuryUrlBuilder extends core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
    constructor(host, path) {
        super();
        this.withSecure(true).withHost(host).withPath(path).withExtension("jpg");
    }
}
MercuryUrlBuilder.Basemap = new MercuryUrlBuilder("trek.nasa.gov", "tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0/default/default028mm/{z}/{y}/{x}.{extension}");
class Mercury {
    static BasemapClient(options) {
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.TileWebClient(`${Mercury.KEY}_basemap`, MercuryUrlBuilder.Basemap, new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ImageTileCodec(), Mercury.Metrics, options);
    }
}
Mercury.KEY = "mercury";
Mercury.MaxLevelOfDetail = 7;
Mercury.Metrics = new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.EPSG3857({ maxLOD: Mercury.MaxLevelOfDetail }, ___WEBPACK_IMPORTED_MODULE_1__.SolarSystemBodies.Mercury.ellipsoid);
Mercury.Attribution = "NASA / USGS / MESSENGER";
//# sourceMappingURL=space.vendor.mercury.js.map

/***/ },

/***/ "./dist/vendors/space.vendor.moon.js"
/*!*******************************************!*\
  !*** ./dist/vendors/space.vendor.moon.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Moon: () => (/* binding */ Moon),
/* harmony export */   MoonUrlBuilder: () => (/* binding */ MoonUrlBuilder)
/* harmony export */ });
/* harmony import */ var core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/dem/dem.tileclient */ "core/math/math.units");
/* harmony import */ var core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! .. */ "./dist/space.bodies.js");









class MoonUrlBuilder extends core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
    constructor(host, path, tms = false) {
        super();
        this.withSecure(true).withHost(host).withPath(path).withExtension("png");
        if (tms) {
            this.withTMSY(true);
        }
    }
}
/** Carto CDN — supports CORS */
MoonUrlBuilder.Basemap = new MoonUrlBuilder("cartocdn-gusc.global.ssl.fastly.net", "opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.{extension}");
/** Raw S3 — no CORS headers, TMS Y convention, must be loaded via <img> */
MoonUrlBuilder.HillshadeAlbedo = new MoonUrlBuilder("s3.amazonaws.com", "opmbuilder/301_moon/tiles/w/hillshaded-albedo/{z}/{x}/{y}.{extension}", true);
class Moon {
    static BasemapClient(options) {
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.TileWebClient(`${Moon.KEY}_basemap`, MoonUrlBuilder.Basemap, new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ImageTileCodec(), Moon.Metrics, options);
    }
    static HillshadeClient(options) {
        // Uses ImageTileClient (loads via <img>) because S3 does not serve CORS headers
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ImageTileClient(`${Moon.KEY}_hillshade`, MoonUrlBuilder.HillshadeAlbedo, Moon.Metrics, options);
    }
    /**
     * Returns a tile client that fetches LOLA DEM elevations as Float32Array.
     * Each pixel is decoded from ArcGIS grayscale (0–255) to meters using the LOLA elevation range.
     */
    static ElevationsClient(options) {
        const urlBuilder = new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ArcGISImageServerUrlBuilder(Moon.LOLA_DEM_URL, ___WEBPACK_IMPORTED_MODULE_1__.SolarSystemBodies.Moon.ellipsoid.semiMajorAxis);
        const decoder = new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.ArcGISGrayscaleElevationDecoder(Moon.LOLA_MIN, Moon.LOLA_MAX);
        const o = (0,core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.isFilter)(options?.filter) ? new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.Float32TileCodecOptions({ filter: options?.filter }) : undefined;
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.TileWebClient(`${Moon.KEY}_lola_dem`, urlBuilder, new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.Float32TileCodec(decoder, o), Moon.Metrics, options);
    }
    /**
     * Returns a DEM tile client combining LOLA elevations with computed normals.
     * Compatible with the existing DemTileWebClient pipeline.
     */
    static DemClient(options) {
        return new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.DemTileWebClient(`${Moon.KEY}_dem`, Moon.ElevationsClient(options));
    }
}
Moon.KEY = "moon";
Moon.MaxLevelOfDetail = 7;
Moon.Metrics = new core_tiles_tiles_client__WEBPACK_IMPORTED_MODULE_0__.EPSG3857({ maxLOD: Moon.MaxLevelOfDetail }, ___WEBPACK_IMPORTED_MODULE_1__.SolarSystemBodies.Moon.ellipsoid);
Moon.Attribution = "OpenPlanetary / USGS / NASA";
// LOLA DEM elevation range (meters)
Moon.LOLA_MIN = -9128;
Moon.LOLA_MAX = 10786;
/** NASA Trek ArcGIS ImageServer — LRO LOLA DEM (256 ppd) */
Moon.LOLA_DEM_URL = "https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer/exportImage";
//# sourceMappingURL=space.vendor.moon.js.map

/***/ },

/***/ "core/math/math.units"
/*!**************************!*\
  !*** external "SPACEXR" ***!
  \**************************/
(module) {

module.exports = SPACEXR;

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***********************!*\
  !*** ./dist/index.js ***!
  \***********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AxialTilt: () => (/* reexport safe */ _space_axialTilt__WEBPACK_IMPORTED_MODULE_0__.AxialTilt),
/* harmony export */   CelestialNodeType: () => (/* reexport safe */ _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType),
/* harmony export */   CelestialTracker: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.CelestialTracker),
/* harmony export */   ColorValue: () => (/* reexport safe */ _space_starColor__WEBPACK_IMPORTED_MODULE_3__.ColorValue),
/* harmony export */   EquatorialVector: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.EquatorialVector),
/* harmony export */   HorizonVector: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.HorizonVector),
/* harmony export */   JulianDate: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.JulianDate),
/* harmony export */   KeplerOrbitBase: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.KeplerOrbitBase),
/* harmony export */   Mars: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_6__.Mars),
/* harmony export */   MarsUrlBuilder: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_6__.MarsUrlBuilder),
/* harmony export */   Mercury: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_6__.Mercury),
/* harmony export */   MercuryUrlBuilder: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_6__.MercuryUrlBuilder),
/* harmony export */   Moon: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_6__.Moon),
/* harmony export */   MoonKnownPlaces: () => (/* reexport safe */ _space_knownPlaces_moon__WEBPACK_IMPORTED_MODULE_7__.MoonKnownPlaces),
/* harmony export */   MoonState: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.MoonState),
/* harmony export */   MoonUrlBuilder: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_6__.MoonUrlBuilder),
/* harmony export */   MorganKeenanClass: () => (/* reexport safe */ _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__.MorganKeenanClass),
/* harmony export */   SolarSystemBodies: () => (/* reexport safe */ _space_bodies__WEBPACK_IMPORTED_MODULE_5__.SolarSystemBodies),
/* harmony export */   SpectralClass: () => (/* reexport safe */ _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__.SpectralClass),
/* harmony export */   StarColor: () => (/* reexport safe */ _space_starColor__WEBPACK_IMPORTED_MODULE_3__.StarColor),
/* harmony export */   SunTrajectoryConfig: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.SunTrajectoryConfig)
/* harmony export */ });
/* harmony import */ var _space_axialTilt__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.axialTilt */ "./dist/space.axialTilt.js");
/* harmony import */ var _space_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./space.interfaces */ "./dist/space.interfaces.js");
/* harmony import */ var _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./space.spectralClass */ "./dist/space.spectralClass.js");
/* harmony import */ var _space_starColor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./space.starColor */ "./dist/space.starColor.js");
/* harmony import */ var _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Mechanics/index */ "./dist/Mechanics/index.js");
/* harmony import */ var _space_bodies__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./space.bodies */ "./dist/space.bodies.js");
/* harmony import */ var _vendors_index__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./vendors/index */ "./dist/vendors/index.js");
/* harmony import */ var _space_knownPlaces_moon__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./space.knownPlaces.moon */ "./dist/space.knownPlaces.moon.js");








//# sourceMappingURL=index.js.map
})();

SPACEXR_SPACE = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=spacexr_space.1.0.0.js.map