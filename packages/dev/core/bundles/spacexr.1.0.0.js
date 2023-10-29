var SPACEXR;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dist/dem/dem.infos.js":
/*!*******************************!*\
  !*** ./dist/dem/dem.infos.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DemInfos": () => (/* binding */ DemInfos)
/* harmony export */ });
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geometry/geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");

class DemInfos {
    static GetVector(z, i, stride) {
        const y = Math.floor(i / stride);
        const x = i - y * stride;
        return new _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3(x, y, z);
    }
    constructor(elevations, normals = null, stride, pos, size) {
        this._max = _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Zero();
        this._min = _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Zero();
        this._delta = 0;
        this._mean = 0;
        this._elevations = null;
        this._normals = null;
        this._stride = 0;
        this._elevations = elevations;
        this._normals = normals;
        if (this._elevations) {
            const length = this._elevations?.length;
            this._stride = stride || Math.sqrt(length);
            let min = Number.MAX_SAFE_INTEGER;
            let max = Number.MIN_SAFE_INTEGER;
            let mean = -this._elevations[0] / length;
            let mini = 0;
            let maxi = 0;
            const x0 = pos?.x || 0;
            const x1 = x0 + (size?.width || this._stride);
            const y0 = pos?.y || 0;
            const y1 = y0 + (size?.height || this._stride);
            for (let y = y0; y < y1; y++) {
                const j = y * this._stride;
                for (let x = x0; x < x1; x++) {
                    const i = j + x;
                    const z = this._elevations[i];
                    if (z < min) {
                        min = z;
                        mini = i;
                    }
                    else if (z > max) {
                        max = z;
                        maxi = i;
                    }
                    mean += z / length;
                }
            }
            this._max = DemInfos.GetVector(max, maxi, this._stride);
            this._min = DemInfos.GetVector(min, mini, this._stride);
            this._delta = this._max.z - this._min.z;
            this._mean = mean;
        }
    }
    get max() {
        return this._max;
    }
    get min() {
        return this._min;
    }
    get delta() {
        return this._delta;
    }
    get mean() {
        return this._mean;
    }
    get elevations() {
        return this._elevations;
    }
    get normals() {
        return this._normals;
    }
    toString() {
        return `elevations count:${this._elevations?.length || 0}, min:{${this._min.toString()}}, max:{${this._max.toString()}}, delta:${this._delta}, mean:${this._mean}}`;
    }
    getDemInfoView(pos, size) {
        return new DemInfos(this._elevations, this._normals, this._stride, pos, size);
    }
}
//# sourceMappingURL=dem.infos.js.map

/***/ }),

/***/ "./dist/dem/dem.tileclient.js":
/*!************************************!*\
  !*** ./dist/dem/dem.tileclient.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DemTileWebClient": () => (/* binding */ DemTileWebClient)
/* harmony export */ });
/* harmony import */ var _tiles_tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles/tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _dem_infos__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./dem.infos */ "./dist/dem/dem.infos.js");


class DemTileWebClient {
    constructor(elevationSrc, normalSrc) {
        this._elevationsDataSource = elevationSrc;
        this._normalsDataSource = normalSrc;
    }
    get metrics() {
        return this._elevationsDataSource.metrics;
    }
    async fetchAsync(request, ...userArgs) {
        const requests = [];
        requests.push(this._elevationsDataSource.fetchAsync(request, ...userArgs));
        if (this._normalsDataSource) {
            requests.push(this._normalsDataSource.fetchAsync(request, ...userArgs));
        }
        const results = await Promise.allSettled(requests);
        let elevations = null;
        let normals = null;
        if (results[0].status == "fulfilled") {
            elevations = results[0].value.content;
        }
        else {
            throw new Error(results[0].reason);
        }
        if (elevations == null) {
            return new _tiles_tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.FetchResult(request, null, userArgs);
        }
        if (results.length > 1) {
            if (results[1].status == "fulfilled") {
                normals = results[1].value.content;
            }
        }
        if (normals == null) {
            const s = this.metrics.tileSize;
            normals = this.computeNormals(elevations, s, s);
        }
        return new _tiles_tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.FetchResult(request, new _dem_infos__WEBPACK_IMPORTED_MODULE_1__.DemInfos(elevations, normals), userArgs);
    }
    computeNormals(positions, w, h) {
        const normals = new Uint8ClampedArray(w * h * 3);
        const indices = [0, 3, 6, 15, 24, 21, 18, 9];
        let i = 0;
        for (let row = 0; row < w; row++) {
            for (let col = 0; col < h; col++) {
                let nx = 0;
                let ny = 0;
                let nz = 0;
                let nn = 0;
                const v = this.getNormalsWindows(positions, row, col, w, h);
                let k = indices[0];
                let a1 = v[k++];
                let a2 = v[k++];
                let a3 = v[k];
                for (let i = 1; i < indices.length; i++) {
                    k = indices[i];
                    const b1 = v[k++];
                    const b2 = v[k++];
                    const b3 = v[k];
                    if (a3 !== undefined && b3 !== undefined) {
                        const na = a2 * b3 - a3 * b2;
                        const nb = a3 * b1 - a1 * b3;
                        const nc = a1 * b2 - a2 * b1;
                        nx += na;
                        ny += nb;
                        nz += nc;
                        nn++;
                    }
                    a1 = b1;
                    a2 = b2;
                    a3 = b3;
                }
                const x = nx / nn;
                const y = ny / nn;
                const z = nz / nn;
                const l = Math.sqrt(x * x + y * y + z * z);
                const R = ((x / l + 1) / 2) * 255;
                const G = ((y / l + 1) / 2) * 255;
                const B = (z / l) * 127 + 128;
                normals[i++] = R;
                normals[i++] = G;
                normals[i++] = B;
            }
        }
        return normals;
    }
    getNormalsWindows(positions, i, j, w, h) {
        let index = (i * w + j) * 3;
        const xref = positions[index++];
        const yref = positions[index++];
        const zref = positions[index];
        const windows = new Array(27);
        const startRow = i - 1;
        const endRow = i + 1;
        const startCol = j - 1;
        const endCol = j + 1;
        let k = 0;
        for (let row = startRow; row <= endRow; row++) {
            const offset = row * w;
            for (let col = startCol; col <= endCol; col++) {
                index = (offset + col) * 3;
                let dx = col < 0 ? undefined : col >= w ? undefined : positions[index] - xref;
                let dy = row < 0 ? undefined : row >= h ? undefined : positions[index + 1] - yref;
                let dz = dx === undefined || dy === undefined ? undefined : positions[index + 2] - zref;
                windows[k++] = dx;
                windows[k++] = dy;
                windows[k++] = dz;
            }
        }
        return windows;
    }
}
//# sourceMappingURL=dem.tileclient.js.map

/***/ }),

/***/ "./dist/dem/index.js":
/*!***************************!*\
  !*** ./dist/dem/index.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DemInfos": () => (/* reexport safe */ _dem_infos__WEBPACK_IMPORTED_MODULE_0__.DemInfos),
/* harmony export */   "DemTileWebClient": () => (/* reexport safe */ _dem_tileclient__WEBPACK_IMPORTED_MODULE_1__.DemTileWebClient)
/* harmony export */ });
/* harmony import */ var _dem_infos__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dem.infos */ "./dist/dem/dem.infos.js");
/* harmony import */ var _dem_tileclient__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./dem.tileclient */ "./dist/dem/dem.tileclient.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/events/events.args.js":
/*!************************************!*\
  !*** ./dist/events/events.args.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventArgs": () => (/* binding */ EventArgs),
/* harmony export */   "PropertyChangedEventArgs": () => (/* binding */ PropertyChangedEventArgs)
/* harmony export */ });
class EventArgs {
    constructor(source) {
        this._source = source;
    }
    get source() {
        return this._source;
    }
}
class PropertyChangedEventArgs extends EventArgs {
    constructor(source, oldValue, newValue) {
        super(source);
        this._o = oldValue;
        this._v = newValue;
    }
    get oldValue() {
        return this._o;
    }
    get value() {
        return this._v;
    }
}
//# sourceMappingURL=events.args.js.map

/***/ }),

/***/ "./dist/events/events.emitter.js":
/*!***************************************!*\
  !*** ./dist/events/events.emitter.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventEmitter": () => (/* binding */ EventEmitter)
/* harmony export */ });
class EventEmitter {
    constructor(maxListeners = EventEmitter.defaultMaxListeners) {
        this._events = new Map();
        this._maxListeners = maxListeners;
    }
    addListener(eventName, listener) {
        return this.on(eventName, listener);
    }
    on(eventName, listener) {
        this._registerEvent(eventName, listener, false);
        return this;
    }
    once(eventName, listener) {
        this._registerEvent(eventName, listener, true);
        return this;
    }
    emit(eventName, ...args) {
        const listeners = this._events.get(eventName);
        const listenerCount = this.listenerCount(eventName);
        if (listeners) {
            listeners.map((listener) => listener(...args));
        }
        return listenerCount === 0 ? false : true;
    }
    eventNames() {
        return Array.from(this._events.keys());
    }
    getMaxListeners() {
        return this._maxListeners === null ? EventEmitter.defaultMaxListeners : this._maxListeners;
    }
    setMaxListeners(limit) {
        this._maxListeners = limit;
        return this;
    }
    listeners(eventName) {
        return this._events.get(eventName);
    }
    listenerCount(eventName) {
        const event = this._events.get(eventName);
        return event === undefined ? 0 : event.length;
    }
    removeAllListeners(eventNames) {
        if (!eventNames) {
            eventNames = Array.from(this._events.keys());
        }
        eventNames.forEach((eventName) => this._events.delete(eventName));
        return this;
    }
    removeListener(eventName, listener) {
        if (this.listeners) {
            const l = this.listeners(eventName);
            if (l) {
                const listeners = l.filter((item) => listener === undefined || listener === null || item === listener);
                this._events.set(eventName, listeners);
            }
        }
        return this;
    }
    _registerEvent(eventName, listener, type) {
        if (this._ListenerLimitReached(eventName)) {
            console.log("Maximum listener reached, new Listener not added");
            return;
        }
        if (type === true) {
            listener = this._createOnceListener(listener, eventName);
        }
        const listeners = this._createListeners(listener, this.listeners(eventName));
        this._events.set(eventName, listeners);
        return;
    }
    _createListeners(listener, listeners) {
        if (!listeners) {
            listeners = new Array();
        }
        listeners.push(listener);
        return listeners;
    }
    _createOnceListener(listener, eventName) {
        const newListener = (...args) => {
            this.removeListener(eventName, listener);
            return listener(...args);
        };
        return newListener;
    }
    _ListenerLimitReached(eventName) {
        return this.listenerCount(eventName) === this.getMaxListeners() ? true : false;
    }
}
EventEmitter.defaultMaxListeners = 100;

//# sourceMappingURL=events.emitter.js.map

/***/ }),

/***/ "./dist/events/events.observable.js":
/*!******************************************!*\
  !*** ./dist/events/events.observable.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventState": () => (/* binding */ EventState),
/* harmony export */   "Observable": () => (/* binding */ Observable),
/* harmony export */   "Observer": () => (/* binding */ Observer)
/* harmony export */ });
class EventState {
    constructor(mask, skipNextObservers = false, target, currentTarget) {
        this.initialize(mask, skipNextObservers, target, currentTarget);
    }
    initialize(mask, skipNextObservers = false, target, currentTarget) {
        this.mask = mask;
        this.skipNextObservers = skipNextObservers;
        this.target = target;
        this.currentTarget = currentTarget;
        return this;
    }
}
class Observer {
    constructor(source, callback, mask, scope = null) {
        this.source = source;
        this.callback = callback;
        this.mask = mask;
        this.scope = scope;
        this._willBeUnregistered = false;
        this.unregisterOnNextCall = false;
    }
    dispose() {
        this.source.remove(this);
    }
}
class Observable {
    static FromPromise(promise, onErrorObservable) {
        const observable = new Observable();
        promise
            .then((ret) => {
            observable.notifyObservers(ret);
        })
            .catch((err) => {
            if (onErrorObservable) {
                onErrorObservable.notifyObservers(err);
            }
            else {
                throw err;
            }
        });
        return observable;
    }
    get observers() {
        return this._observers;
    }
    constructor(onObserverAdded) {
        this._observers = new Array();
        this._eventState = new EventState(0);
        if (onObserverAdded) {
            this._onObserverAdded = onObserverAdded;
        }
    }
    add(callback, mask = -1, insertFirst = false, scope = null, unregisterOnFirstCall = false) {
        if (!callback) {
            return null;
        }
        const observer = new Observer(this, callback, mask, scope);
        observer.unregisterOnNextCall = unregisterOnFirstCall;
        if (insertFirst) {
            this._observers.unshift(observer);
        }
        else {
            this._observers.push(observer);
        }
        if (this._onObserverAdded) {
            this._onObserverAdded(observer);
        }
        return observer;
    }
    addOnce(callback) {
        return this.add(callback, undefined, undefined, undefined, true);
    }
    remove(observer) {
        if (!observer) {
            return false;
        }
        const index = this._observers.indexOf(observer);
        if (index !== -1) {
            this._deferUnregister(observer);
            return true;
        }
        return false;
    }
    removeCallback(callback, scope) {
        for (let index = 0; index < this._observers.length; index++) {
            const observer = this._observers[index];
            if (observer._willBeUnregistered) {
                continue;
            }
            if (observer.callback === callback && (!scope || scope === observer.scope)) {
                this._deferUnregister(observer);
                return true;
            }
        }
        return false;
    }
    _deferUnregister(observer) {
        observer.unregisterOnNextCall = false;
        observer._willBeUnregistered = true;
        setTimeout(() => {
            this._remove(observer);
        }, 0);
    }
    _remove(observer) {
        if (!observer) {
            return false;
        }
        const index = this._observers.indexOf(observer);
        if (index !== -1) {
            this._observers.splice(index, 1);
            return true;
        }
        return false;
    }
    makeObserverTopPriority(observer) {
        this._remove(observer);
        this._observers.unshift(observer);
    }
    makeObserverBottomPriority(observer) {
        this._remove(observer);
        this._observers.push(observer);
    }
    notifyObservers(eventData, mask = -1, target, currentTarget, userInfo) {
        if (!this._observers.length) {
            return true;
        }
        const state = this._eventState;
        state.mask = mask;
        state.target = target;
        state.currentTarget = currentTarget;
        state.skipNextObservers = false;
        state.lastReturnValue = eventData;
        state.userInfo = userInfo;
        for (const obs of this._observers) {
            if (obs._willBeUnregistered) {
                continue;
            }
            if (obs.mask & mask) {
                if (obs.scope) {
                    state.lastReturnValue = obs.callback.apply(obs.scope, [eventData, state]);
                }
                else {
                    state.lastReturnValue = obs.callback(eventData, state);
                }
                if (obs.unregisterOnNextCall) {
                    this._deferUnregister(obs);
                }
            }
            if (state.skipNextObservers) {
                return false;
            }
        }
        return true;
    }
    notifyObserver(observer, eventData, mask = -1) {
        if (observer._willBeUnregistered) {
            return;
        }
        const state = this._eventState;
        state.mask = mask;
        state.skipNextObservers = false;
        observer.callback(eventData, state);
        if (observer.unregisterOnNextCall) {
            this._deferUnregister(observer);
        }
    }
    hasObservers() {
        return this._observers.length > 0;
    }
    clear() {
        this._observers = new Array();
        this._onObserverAdded = null;
    }
    clone() {
        const result = new Observable();
        result._observers = this._observers.slice(0);
        return result;
    }
    hasSpecificMask(mask = -1) {
        for (const obs of this._observers) {
            if (obs.mask & mask || obs.mask === mask) {
                return true;
            }
        }
        return false;
    }
}
//# sourceMappingURL=events.observable.js.map

/***/ }),

/***/ "./dist/events/index.js":
/*!******************************!*\
  !*** ./dist/events/index.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventArgs": () => (/* reexport safe */ _events_args__WEBPACK_IMPORTED_MODULE_2__.EventArgs),
/* harmony export */   "EventEmitter": () => (/* reexport safe */ _events_emitter__WEBPACK_IMPORTED_MODULE_0__.EventEmitter),
/* harmony export */   "EventState": () => (/* reexport safe */ _events_observable__WEBPACK_IMPORTED_MODULE_1__.EventState),
/* harmony export */   "Observable": () => (/* reexport safe */ _events_observable__WEBPACK_IMPORTED_MODULE_1__.Observable),
/* harmony export */   "Observer": () => (/* reexport safe */ _events_observable__WEBPACK_IMPORTED_MODULE_1__.Observer),
/* harmony export */   "PropertyChangedEventArgs": () => (/* reexport safe */ _events_args__WEBPACK_IMPORTED_MODULE_2__.PropertyChangedEventArgs)
/* harmony export */ });
/* harmony import */ var _events_emitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./events.emitter */ "./dist/events/events.emitter.js");
/* harmony import */ var _events_observable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./events.observable */ "./dist/events/events.observable.js");
/* harmony import */ var _events_args__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./events.args */ "./dist/events/events.args.js");




//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geodesy/geodesy.ellipsoid.js":
/*!*******************************************!*\
  !*** ./dist/geodesy/geodesy.ellipsoid.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Ellipsoid": () => (/* binding */ Ellipsoid)
/* harmony export */ });
class Ellipsoid {
    static FromAAndInverseF(name, semiMajor, inverseFlattening) {
        const f = 1.0 / inverseFlattening;
        const b = (1.0 - f) * semiMajor;
        return new Ellipsoid(name, semiMajor, b, f, inverseFlattening);
    }
    static FromAAndF(name, semiMajor, flattening) {
        const inverseF = 1.0 / flattening;
        const b = (1.0 - flattening) * semiMajor;
        return new Ellipsoid(name, semiMajor, b, flattening, inverseF);
    }
    constructor(name, semiMajor, semiMinor, flattening, inverseFlattening) {
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
    get name() {
        return this._name;
    }
    get semiMajorAxis() {
        return this._a;
    }
    get semiMinorAxis() {
        return this._b;
    }
    get flattening() {
        return this._f;
    }
    get inverseFlattening() {
        return this._invf;
    }
    get linearEccentricity() {
        return this._c;
    }
    get eccentricity() {
        return this._e;
    }
    get sqrEccentricity() {
        return this._ee;
    }
    get oneMinusSqrEccentricity() {
        return this._p1mee;
    }
    get semiLatusRectum() {
        return this._p1mee * this._a;
    }
    isEquals(other) {
        return other && other._a == this._a && other._b == this._b;
    }
    clone(name, scale = 1.0) {
        return new Ellipsoid(name, this._a * scale, this._b * scale, this._f, this._invf);
    }
}
Ellipsoid.WGS84 = Ellipsoid.FromAAndInverseF("WGS84", 6378137.0, 298.257223563);
Ellipsoid.GRS80 = Ellipsoid.FromAAndInverseF("GRS80", 6378137.0, 298.257222101);
Ellipsoid.GRS67 = Ellipsoid.FromAAndInverseF("GRS67", 6378160.0, 298.25);
Ellipsoid.ANS = Ellipsoid.FromAAndInverseF("ANS", 6378160.0, 298.25);
Ellipsoid.WGS72 = Ellipsoid.FromAAndInverseF("WGS72", 6378135.0, 298.26);
Ellipsoid.Clarke1858 = Ellipsoid.FromAAndInverseF("Clarke1858", 6378293.645, 294.26);
Ellipsoid.Clarke1880 = Ellipsoid.FromAAndInverseF("Clarke1880", 6378249.145, 293.465);

//# sourceMappingURL=geodesy.ellipsoid.js.map

/***/ }),

/***/ "./dist/geodesy/geodesy.system.js":
/*!****************************************!*\
  !*** ./dist/geodesy/geodesy.system.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CartesianMode": () => (/* binding */ CartesianMode),
/* harmony export */   "GeodeticSystem": () => (/* binding */ GeodeticSystem)
/* harmony export */ });
/* harmony import */ var _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geodesy.ellipsoid */ "./dist/geodesy/geodesy.ellipsoid.js");
/* harmony import */ var _events_events_observable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../events/events.observable */ "./dist/events/events.observable.js");
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../math */ "./dist/math/math.js");



var CartesianMode;
(function (CartesianMode) {
    CartesianMode[CartesianMode["ECEF"] = 0] = "ECEF";
    CartesianMode[CartesianMode["ENU"] = 1] = "ENU";
    CartesianMode[CartesianMode["NED"] = 2] = "NED";
})(CartesianMode || (CartesianMode = {}));
class GeodeticSystem {
    static GetENUTransformMatrixFromFloat(lat, lon, alt = 0, ellipsoid = _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.WGS84, rowOrder = true) {
        const lambda = lat * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const phi = lon * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const sin_lambda = Math.sin(lambda);
        const N = ellipsoid.semiMajorAxis / Math.sqrt(1 - ellipsoid.sqrEccentricity * sin_lambda * sin_lambda);
        const cos_lambda = Math.cos(lambda);
        const cos_phi = Math.cos(phi);
        const sin_phi = Math.sin(phi);
        const tmp = (alt + N) * cos_lambda;
        const x = tmp * cos_phi;
        const y = tmp * sin_phi;
        const z = (alt + ellipsoid.oneMinusSqrEccentricity * N) * sin_lambda;
        const om0 = -sin_phi;
        const om1 = -sin_lambda * cos_phi;
        const om2 = cos_lambda * cos_phi;
        const om4 = cos_phi;
        const om5 = -sin_lambda * sin_phi;
        const om6 = cos_lambda * sin_phi;
        const om9 = cos_lambda;
        const om10 = sin_lambda;
        const om12 = -x * om0 - y * om4;
        const om13 = -x * om1 - y * om5 - z * om9;
        const om14 = -x * om2 - y * om6 - z * om10;
        if (rowOrder) {
            return [om0, om1, om2, 0, om4, om5, om6, 0, 0, om9, om10, 0, om12, om13, om14, 1.0];
        }
        else {
            return [om0, om4, 0, om12, om1, om5, om9, om13, om2, om6, om10, om14, 0, 0, 0, 1.0];
        }
    }
    constructor(e, bounds) {
        this._ellipsoid = e || _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.WGS84;
        this._bounds = bounds;
    }
    get ellipsoid() {
        return this._ellipsoid;
    }
    get ENUReference() {
        return this._enuReference;
    }
    set ENUReference(v) {
        if (this._enuReference) {
            if (this._enuReference.equals(v)) {
                return;
            }
            this._enuReference = v?.clone();
            this._enuTransform = undefined;
            if (this._enuObservable && this._enuObservable.hasObservers()) {
                this._enuObservable.notifyObservers(this);
            }
        }
    }
    get ENUTransform() {
        if (this._enuTransform === undefined && this._enuReference) {
            this._enuTransform = GeodeticSystem.GetENUTransformMatrixFromFloat(this._enuReference.lat, this._enuReference.lon, this._enuReference.alt, this._ellipsoid);
        }
        return this._enuTransform;
    }
    get ENUObservable() {
        this._enuObservable = this._enuObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_2__.Observable();
        return this._enuObservable;
    }
    get cartesianMode() {
        return this._enuReference !== undefined ? CartesianMode.ENU : CartesianMode.ECEF;
    }
    geodeticToCartesianToRef(geo, target) {
        if (geo && target) {
            let lambda = geo.lat * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
            let phi = geo.lon * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
            let alt = geo.alt || 0;
            const sin_lambda = Math.sin(lambda);
            const cos_lambda = Math.cos(lambda);
            const cos_phi = Math.cos(phi);
            const sin_phi = Math.sin(phi);
            const N = this._ellipsoid._a / Math.sqrt(1.0 - this._ellipsoid._ee * sin_lambda * sin_lambda);
            const tmp = (alt + N) * cos_lambda;
            let x = tmp * cos_phi;
            let y = tmp * sin_phi;
            let z = (alt + this._ellipsoid._p1mee * N) * sin_lambda;
            if (this.ENUTransform) {
                const m = this.ENUTransform;
                const rx = x * m[0] + y * m[4] + z * m[8] + m[12];
                const ry = x * m[1] + y * m[5] + z * m[9] + m[13];
                const rz = x * m[2] + y * m[6] + z * m[10] + m[14];
                x = rx;
                y = ry;
                z = rz;
            }
            target.x = x;
            target.y = y;
            target.z = z;
        }
    }
}
//# sourceMappingURL=geodesy.system.js.map

/***/ }),

/***/ "./dist/geodesy/index.js":
/*!*******************************!*\
  !*** ./dist/geodesy/index.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CartesianMode": () => (/* reexport safe */ _geodesy_system__WEBPACK_IMPORTED_MODULE_1__.CartesianMode),
/* harmony export */   "Ellipsoid": () => (/* reexport safe */ _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid),
/* harmony export */   "GeodeticSystem": () => (/* reexport safe */ _geodesy_system__WEBPACK_IMPORTED_MODULE_1__.GeodeticSystem)
/* harmony export */ });
/* harmony import */ var _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geodesy.ellipsoid */ "./dist/geodesy/geodesy.ellipsoid.js");
/* harmony import */ var _geodesy_system__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geodesy.system */ "./dist/geodesy/geodesy.system.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geography/geography.envelope.js":
/*!**********************************************!*\
  !*** ./dist/geography/geography.envelope.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Envelope": () => (/* binding */ Envelope)
/* harmony export */ });
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../math/math */ "./dist/math/math.js");
/* harmony import */ var _geography_interfaces__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geography.interfaces */ "./dist/geography/geography.interfaces.js");
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry/geometry.size */ "./dist/geometry/geometry.size.js");




class Envelope {
    static FromSize(position, size) {
        const hasAlt = position.alt !== undefined && size.thickness !== undefined;
        const lat0 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(position.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon0 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(position.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt0 = hasAlt ? position.alt : undefined;
        const h = size.width % 180;
        const lat1 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(position.lat + h, Envelope.MinLatitude, Envelope.MaxLatitude);
        const w = size.width % 360;
        const lon1 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(position.lon + w, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt1 = hasAlt ? position.alt + size.thickness : undefined;
        const lower = new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(Math.min(lat0, lat1), Math.min(lon0, lon1), hasAlt ? Math.min(alt0, alt1) : undefined);
        const upper = new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(Math.max(lat0, lat1), Math.max(lon0, lon1), hasAlt ? Math.max(alt0, alt1) : undefined);
        return new Envelope(lower, upper);
    }
    static FromPoints(a, b) {
        const hasAlt = a.alt !== undefined && a.alt !== undefined;
        const lat0 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(a.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon0 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(a.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt0 = hasAlt ? a.alt : undefined;
        const lat1 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(b.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon1 = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.Clamp(b.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt1 = hasAlt ? a.alt : undefined;
        const lower = new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(Math.min(lat0, lat1), Math.min(lon0, lon1), hasAlt ? Math.min(alt0, alt1) : undefined);
        const upper = new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(Math.max(lat0, lat1), Math.max(lon0, lon1), hasAlt ? Math.max(alt0, alt1) : undefined);
        return new Envelope(lower, upper);
    }
    constructor(lowerCorner, upperCorner) {
        this._min = lowerCorner;
        this._max = upperCorner;
    }
    get north() {
        return this._max.lat;
    }
    get south() {
        return this._min.lat;
    }
    get east() {
        return this._max.lon;
    }
    get west() {
        return this._min.lon;
    }
    get bottom() {
        return this._min.alt;
    }
    get top() {
        return this._max.alt;
    }
    get nw() {
        return new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(this.north, this.west);
    }
    get sw() {
        return new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(this.south, this.west);
    }
    get ne() {
        return new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(this.north, this.east);
    }
    get se() {
        return new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(this.south, this.east);
    }
    equals(other) {
        return (other &&
            this._min.lat === other.south &&
            this._min.lon === other.west &&
            this._min.alt === other.bottom &&
            this._max.lat === other.north &&
            this._max.lon === other.east &&
            this._max.alt === other.top);
    }
    clone() {
        return new Envelope(this._min.clone(), this._max.clone());
    }
    get hasAltitude() {
        return this._min.hasAltitude && this._max.hasAltitude;
    }
    get center() {
        const lat = this._min.lon + (this._max.lon - this._min.lon) / 2;
        const lon = this._min.lat + (this._max.lat - this._min.lat) / 2;
        const alt = this.hasAltitude ? this._min.alt + (this._max.alt - this._min.alt) / 2 : undefined;
        return new _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3(lat, lon, alt);
    }
    get size() {
        const w = this._max.lon - this._min.lon;
        const h = this._max.lat - this._min.lat;
        const t = this.hasAltitude ? this._max.alt - this._min.alt : 0;
        return new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_2__.Size3(w, h, t);
    }
    add(lat, lon, alt) {
        return this.clone().addInPlace(lat, lon, alt);
    }
    addInPlace(lat, lon, alt) {
        if ((0,_geography_interfaces__WEBPACK_IMPORTED_MODULE_3__.isLocation)(lat)) {
            return this.addInPlace(lat.lat, lat.lon, lat.alt);
        }
        this._min.lat = Math.min(this._min.lat, lat);
        this._max.lat = Math.max(this._max.lat, lat);
        if (lon) {
            this._min.lon = Math.min(this._min.lon, lon);
            this._max.lon = Math.max(this._max.lon, lon);
        }
        if (this.hasAltitude && alt) {
            this._min.alt = Math.min(this._min.alt, alt);
            this._max.alt = Math.max(this._max.alt, alt);
        }
        return this;
    }
    intersectWith(bounds) {
        if (this._min.lat > bounds.north || this._max.lat < bounds.south || this._min.lon > bounds.east || this._max.lon < bounds.west) {
            return false;
        }
        if (this.hasAltitude && bounds.hasAltitude) {
            if (this._min.alt > bounds.top || this._max.alt < bounds.bottom) {
                return false;
            }
        }
        return true;
    }
    contains(loc) {
        return this.containsFloat(loc.lat, loc.lon, loc.alt);
    }
    containsFloat(lat, lon, alt) {
        return (lat >= this._min.lat &&
            lat <= this._max.lat &&
            (lon === undefined || (lon >= this._min.lon && lon <= this._max.lon)) &&
            (alt === undefined || (this.hasAltitude && alt >= this._min.alt && alt <= this._max.alt)));
    }
}
Envelope.MaxLongitude = 540;
Envelope.MaxLatitude = 90;
Envelope.MinLongitude = -Envelope.MaxLongitude;
Envelope.MinLatitude = -Envelope.MaxLatitude;

//# sourceMappingURL=geography.envelope.js.map

/***/ }),

/***/ "./dist/geography/geography.interfaces.js":
/*!************************************************!*\
  !*** ./dist/geography/geography.interfaces.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isEnvelope": () => (/* binding */ isEnvelope),
/* harmony export */   "isLocation": () => (/* binding */ isLocation)
/* harmony export */ });
function isLocation(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.lat !== undefined && b.lon !== undefined;
}
function isEnvelope(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.nw !== undefined && b.sw !== undefined && b.ne !== undefined && b.nw !== undefined;
}
//# sourceMappingURL=geography.interfaces.js.map

/***/ }),

/***/ "./dist/geography/geography.knownPlaces.js":
/*!*************************************************!*\
  !*** ./dist/geography/geography.knownPlaces.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "KnownPlaces": () => (/* binding */ KnownPlaces)
/* harmony export */ });
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.position */ "./dist/geography/geography.position.js");

class KnownPlaces {
}
KnownPlaces.Locations = {
    Everest: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(27.98817689833976, 86.92491071824738),
    Chamonix: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(45.923351087244384, 6.871072898119941),
    MountRainier: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(46.8523798847489, -121.76034290971147),
    Haleakala: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(20.714420811112593, -156.25254225132156),
    DiamondHead: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(21.26226248048085, -157.80602016703813),
    Krakatoa: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-6.1019466866649115, 105.42296583233852),
};

//# sourceMappingURL=geography.knownPlaces.js.map

/***/ }),

/***/ "./dist/geography/geography.position.js":
/*!**********************************************!*\
  !*** ./dist/geography/geography.position.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Geo2": () => (/* binding */ Geo2),
/* harmony export */   "Geo3": () => (/* binding */ Geo3)
/* harmony export */ });
class Geo2 {
    static Zero() {
        return new Geo2(0, 0);
    }
    constructor(lat, lon) {
        this._lat = lat;
        this._lon = lon;
    }
    get lat() {
        return this._lat;
    }
    get lon() {
        return this._lon;
    }
    set lat(v) {
        this._lat = v;
    }
    set lon(v) {
        this._lon = v;
    }
    clone() {
        return new Geo2(this._lat, this._lon);
    }
    equals(other) {
        return this._lat === other.lat && this._lon === other.lon;
    }
}
Geo2.Default = new Geo2(46.382581, -0.308024);

class Geo3 extends Geo2 {
    static Zero() {
        return new Geo3(0, 0, 0);
    }
    constructor(lat, lon, alt) {
        super(lat, lon);
        this._alt = alt;
    }
    get alt() {
        return this._alt;
    }
    set alt(v) {
        this._alt = v;
    }
    get hasAltitude() {
        return this._alt !== undefined;
    }
    clone() {
        return new Geo3(this._lat, this._lon, this._alt);
    }
    equals(other) {
        return this._lat === other.lat && this._lon === other.lon && this._alt === other.alt;
    }
}
//# sourceMappingURL=geography.position.js.map

/***/ }),

/***/ "./dist/geography/index.js":
/*!*********************************!*\
  !*** ./dist/geography/index.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Envelope": () => (/* reexport safe */ _geography_envelope__WEBPACK_IMPORTED_MODULE_2__.Envelope),
/* harmony export */   "Geo2": () => (/* reexport safe */ _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo2),
/* harmony export */   "Geo3": () => (/* reexport safe */ _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3),
/* harmony export */   "KnownPlaces": () => (/* reexport safe */ _geography_knownPlaces__WEBPACK_IMPORTED_MODULE_3__.KnownPlaces),
/* harmony export */   "isEnvelope": () => (/* reexport safe */ _geography_interfaces__WEBPACK_IMPORTED_MODULE_0__.isEnvelope),
/* harmony export */   "isLocation": () => (/* reexport safe */ _geography_interfaces__WEBPACK_IMPORTED_MODULE_0__.isLocation)
/* harmony export */ });
/* harmony import */ var _geography_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.interfaces */ "./dist/geography/geography.interfaces.js");
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geography_envelope__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geography.envelope */ "./dist/geography/geography.envelope.js");
/* harmony import */ var _geography_knownPlaces__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geography.knownPlaces */ "./dist/geography/geography.knownPlaces.js");




//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geometry/geometry.box.js":
/*!***************************************!*\
  !*** ./dist/geometry/geometry.box.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Box": () => (/* binding */ Box)
/* harmony export */ });
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");


class Box {
    static Zero() {
        return new Box(0, 0, 0, 0, 0, 0);
    }
    static FromSize(size) {
        return new Box(0, 0, 0, size?.width || 0, size.height || 0, size.thickness || 0);
    }
    static FromPoints(...params) {
        let i = 0;
        let xmin = params[i].x;
        let xmax = params[i].x;
        let ymin = params[i].y;
        let ymax = params[i].y;
        let zmin = params[i].z;
        let zmax = params[i++].z;
        for (; i < params.length; i++) {
            const p = params[i];
            if (p) {
                xmin = Math.min(xmin, p.x);
                xmax = Math.max(xmax, p.x);
                ymin = Math.min(ymin, p.y);
                ymax = Math.max(ymax, p.y);
                zmin = Math.min(zmin, p.z);
                zmax = Math.max(zmax, p.z);
            }
        }
        return new Box(xmin, ymin, zmin, xmax - xmin, ymax - ymin, zmax - zmin);
    }
    constructor(x, y, z, width, height, thickness) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.width = width;
        this.height = height;
        this.thickness = thickness;
    }
    get hasThickness() {
        return true;
    }
    get top() {
        return this.y;
    }
    get left() {
        return this.x;
    }
    get right() {
        return this.x + this.width;
    }
    get bottom() {
        return this.y + this.height;
    }
    get floor() {
        return this.z;
    }
    get ceil() {
        return this.z + this.thickness;
    }
    equals(other) {
        if (other) {
            if ((0,_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isBox)(other)) {
                return this.x == other.x && this.y == other.y && this.z == other.z && this.width == other.width && this.height == other.height && this.thickness == other.thickness;
            }
            if ((0,_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isSize3)(other)) {
                return this.width == other.width && this.height == other.height && this.thickness == other.thickness;
            }
            return this.width == other.width && this.height == other.height;
        }
        return false;
    }
    get center() {
        return new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__.Cartesian3(this.x + this.width / 2, this.y + this.height / 2, this.z + this.thickness / 2);
    }
    intersect(other) {
        if (!other ||
            this.bottom < other.top ||
            this.top > other.bottom ||
            this.left > other.right ||
            this.right < other.left ||
            this.floor > other.ceil ||
            this.ceil < other.floor) {
            return false;
        }
        return true;
    }
    intersection(other, ref) {
        if (!this.intersect(other)) {
            return undefined;
        }
        const target = ref || Box.Zero();
        target.y = Math.max(this.top, other.top);
        target.height = Math.min(this.bottom, other.bottom) - target.y;
        target.x = Math.max(this.left, other.left);
        target.width = Math.min(this.right, other.right) - target.x;
        target.z = Math.max(this.floor, other.floor);
        target.width = Math.min(this.ceil, other.ceil) - target.z;
        return target;
    }
    contains(x, y, z) {
        return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom && z >= this.floor && z <= this.ceil;
    }
    toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}, width:${this.width}, height:${this.height}, thickness:${this.thickness}`;
    }
}
//# sourceMappingURL=geometry.box.js.map

/***/ }),

/***/ "./dist/geometry/geometry.cartesian.js":
/*!*********************************************!*\
  !*** ./dist/geometry/geometry.cartesian.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Cartesian2": () => (/* binding */ Cartesian2),
/* harmony export */   "Cartesian3": () => (/* binding */ Cartesian3)
/* harmony export */ });
class Cartesian2 {
    static Zero() {
        return new Cartesian2(0, 0);
    }
    static One() {
        return new Cartesian2(1, 1);
    }
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    toString() {
        return `x:${this.x}, y:${this.y}`;
    }
}
class Cartesian3 {
    static Zero() {
        return new Cartesian3(0, 0, 0);
    }
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}`;
    }
}
//# sourceMappingURL=geometry.cartesian.js.map

/***/ }),

/***/ "./dist/geometry/geometry.interfaces.js":
/*!**********************************************!*\
  !*** ./dist/geometry/geometry.interfaces.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Side": () => (/* binding */ Side),
/* harmony export */   "isBox": () => (/* binding */ isBox),
/* harmony export */   "isCartesian3": () => (/* binding */ isCartesian3),
/* harmony export */   "isRectangle": () => (/* binding */ isRectangle),
/* harmony export */   "isSize2": () => (/* binding */ isSize2),
/* harmony export */   "isSize3": () => (/* binding */ isSize3)
/* harmony export */ });
function isCartesian3(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.x !== undefined && b.y !== undefined && b.z !== undefined;
}
var Side;
(function (Side) {
    Side[Side["left"] = 0] = "left";
    Side[Side["top"] = 1] = "top";
    Side[Side["right"] = 2] = "right";
    Side[Side["bottom"] = 3] = "bottom";
})(Side || (Side = {}));
function isSize2(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.height !== undefined && b.width !== undefined;
}
function isSize3(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.height !== undefined && b.width !== undefined && b.thickness !== undefined;
}
function isRectangle(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.ymax !== undefined && b.xmin !== undefined && b.xmax !== undefined && b.ymin !== undefined;
}
function isBox(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return (b.top !== undefined &&
        b.left !== undefined &&
        b.right !== undefined &&
        b.bottom !== undefined &&
        b.floor !== undefined &&
        b.ceil !== undefined);
}
//# sourceMappingURL=geometry.interfaces.js.map

/***/ }),

/***/ "./dist/geometry/geometry.rectangle.js":
/*!*********************************************!*\
  !*** ./dist/geometry/geometry.rectangle.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Rectangle": () => (/* binding */ Rectangle)
/* harmony export */ });
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");

class Rectangle {
    static Zero() {
        return new Rectangle(0, 0, 0, 0);
    }
    static FromSize(size) {
        return new Rectangle(0, 0, size?.width || 0, size.height || 0);
    }
    static FromPoints(...params) {
        let i = 0;
        let xmin = params[i].x;
        let xmax = params[i].x;
        let ymin = params[i].y;
        let ymax = params[i++].y;
        for (; i < params.length; i++) {
            const p = params[i];
            if (p) {
                xmin = Math.min(xmin, p.x);
                xmax = Math.max(xmax, p.x);
                ymin = Math.min(ymin, p.y);
                ymax = Math.max(ymax, p.y);
            }
        }
        return new Rectangle(xmin, ymin, xmax - xmin, ymax - ymin);
    }
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    *points() {
        const r = this.xmax;
        const t = this.ymax;
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(this.xmin, this.ymin);
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(this.xmin, t);
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(r, t);
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(r, this.ymin);
    }
    clone() {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }
    get ymax() {
        return this.y + this.height;
    }
    get xmin() {
        return this.x;
    }
    get xmax() {
        return this.x + this.width;
    }
    get ymin() {
        return this.y;
    }
    get center() {
        return new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(this.x + this.width / 2, this.y + this.height / 2);
    }
    intersect(other) {
        if (!other || this.ymin > other.ymax || this.ymax < other.ymin || this.xmin > other.xmax || this.xmax < other.xmin) {
            return false;
        }
        return true;
    }
    intersection(other, ref) {
        if (!this.intersect(other)) {
            return undefined;
        }
        const target = ref || Rectangle.Zero();
        target.y = Math.max(this.ymin, other.ymin);
        target.height = Math.min(this.ymax, other.ymax) - target.y;
        target.x = Math.max(this.xmin, other.xmin);
        target.width = Math.min(this.xmax, other.xmax) - target.x;
        return target;
    }
    unionInPlace(other) {
        const x1 = Math.min(this.x, other.x);
        const y1 = Math.min(this.y, other.y);
        const x2 = Math.max(this.xmax, other.xmax);
        const y2 = Math.max(this.ymax, other.ymax);
        this.x = x1;
        this.y = y1;
        this.width = x2 - x1;
        this.height = y2 - y1;
        return this;
    }
    contains(x, y) {
        return x >= this.xmin && x <= this.xmax && y >= this.ymax && y <= this.ymin;
    }
    toString() {
        return `left:${this.xmin}, bottom:${this.ymin}, right:${this.xmax}, top:${this.ymax}, width:${this.width}, height:${this.height}`;
    }
}
//# sourceMappingURL=geometry.rectangle.js.map

/***/ }),

/***/ "./dist/geometry/geometry.size.js":
/*!****************************************!*\
  !*** ./dist/geometry/geometry.size.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Size2": () => (/* binding */ Size2),
/* harmony export */   "Size3": () => (/* binding */ Size3)
/* harmony export */ });
class Size2 {
    static Zero() {
        return new Size2(0, 0);
    }
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    clone() {
        return new Size2(this.width, this.height);
    }
    equals(other) {
        return this.height === other.height && this.width === other.width;
    }
}
class Size3 extends Size2 {
    static Zero() {
        return new Size3(0, 0, 0);
    }
    constructor(width, height, thickness) {
        super(width, height);
        this.thickness = thickness;
    }
    get hasThickness() {
        return this.thickness !== undefined;
    }
    clone() {
        return new Size3(this.width, this.height, this.thickness);
    }
    equals(other) {
        return this.height === other.height && this.width === other.width && this.thickness === other.thickness;
    }
}
//# sourceMappingURL=geometry.size.js.map

/***/ }),

/***/ "./dist/geometry/index.js":
/*!********************************!*\
  !*** ./dist/geometry/index.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Box": () => (/* reexport safe */ _geometry_box__WEBPACK_IMPORTED_MODULE_4__.Box),
/* harmony export */   "Cartesian2": () => (/* reexport safe */ _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__.Cartesian2),
/* harmony export */   "Cartesian3": () => (/* reexport safe */ _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__.Cartesian3),
/* harmony export */   "Rectangle": () => (/* reexport safe */ _geometry_rectangle__WEBPACK_IMPORTED_MODULE_2__.Rectangle),
/* harmony export */   "Side": () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side),
/* harmony export */   "Size2": () => (/* reexport safe */ _geometry_size__WEBPACK_IMPORTED_MODULE_3__.Size2),
/* harmony export */   "Size3": () => (/* reexport safe */ _geometry_size__WEBPACK_IMPORTED_MODULE_3__.Size3),
/* harmony export */   "isBox": () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isBox),
/* harmony export */   "isCartesian3": () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isCartesian3),
/* harmony export */   "isRectangle": () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isRectangle),
/* harmony export */   "isSize2": () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isSize2),
/* harmony export */   "isSize3": () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isSize3)
/* harmony export */ });
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_rectangle__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geometry.rectangle */ "./dist/geometry/geometry.rectangle.js");
/* harmony import */ var _geometry_size__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geometry.size */ "./dist/geometry/geometry.size.js");
/* harmony import */ var _geometry_box__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geometry.box */ "./dist/geometry/geometry.box.js");





//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/map/canvas/controller.canvas.js":
/*!**********************************************!*\
  !*** ./dist/map/canvas/controller.canvas.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CanvasController": () => (/* binding */ CanvasController)
/* harmony export */ });
/* harmony import */ var _tiles_tiles_mapview__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../tiles/tiles.mapview */ "./dist/tiles/tiles.mapview.js");
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geometry/geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../math/math */ "./dist/math/math.js");
/* harmony import */ var _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../geometry/geometry.rectangle */ "./dist/geometry/geometry.rectangle.js");




class CanvasController {
    constructor(canvas, ui) {
        this._lod = 0;
        this._scale = 1;
        this._center = _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
        this._canvas = canvas;
        this._ui = ui || this;
        this._resizeObserver = new ResizeObserver(() => {
            this.invalidateDisplay();
        });
        this._resizeObserver.observe(canvas);
    }
    get view() {
        return this._view;
    }
    get levelOfDetail() {
        return this._lod;
    }
    attachView(view) {
        this.detachView();
        this._view = view;
        this._observer = this._view.updateObservable.add((e) => this.onUpdate(e));
    }
    detachView() {
        if (this._view && this._observer) {
            this._view.updateObservable.remove(this._observer);
            this._view = null;
            this._observer = null;
        }
    }
    onUpdate(args) {
        if (!args) {
            return;
        }
        switch (args.reason) {
            case _tiles_tiles_mapview__WEBPACK_IMPORTED_MODULE_1__.UpdateReason.viewChanged: {
                this.onUpdateView(args);
                break;
            }
        }
    }
    onUpdateView(args) {
        this._lod = args.lod;
        this._scale = args.scale;
        this._center = args.center;
        this.invalidateDisplay();
    }
    invalidateDisplay(rect) {
        if (this._canvas) {
            const ctx = this._canvas.getContext("2d");
            if (ctx) {
                const displayWidth = this._canvas.clientWidth;
                const displayHeight = this._canvas.clientHeight;
                rect = rect || new _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_2__.Rectangle(0, 0, displayWidth, displayHeight);
                ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
                this.invalidateCanvas(ctx, rect);
            }
        }
    }
    invalidateCanvas(ctx, rect) {
        if (ctx) {
            const scale = this._scale;
            ctx.save();
            ctx.translate(rect.width / 2, rect.height / 2);
            ctx.scale(scale, scale);
            const rotation = this._view?.azimuth;
            if (rotation) {
                const angle = rotation * _math_math__WEBPACK_IMPORTED_MODULE_3__.Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            this._ui.invalidateContent(ctx, rect, this);
            ctx.restore();
        }
    }
    invalidateContent(ctx, rect, src) { }
}
//# sourceMappingURL=controller.canvas.js.map

/***/ }),

/***/ "./dist/map/canvas/index.js":
/*!**********************************!*\
  !*** ./dist/map/canvas/index.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CanvasController": () => (/* reexport safe */ _controller_canvas__WEBPACK_IMPORTED_MODULE_2__.CanvasController),
/* harmony export */   "CanvasDisplay": () => (/* reexport safe */ _map_canvas_display__WEBPACK_IMPORTED_MODULE_1__.CanvasDisplay),
/* harmony export */   "CanvasTileMap": () => (/* reexport safe */ _map_canvas__WEBPACK_IMPORTED_MODULE_0__.CanvasTileMap),
/* harmony export */   "CanvasTileMapOptions": () => (/* reexport safe */ _map_canvas__WEBPACK_IMPORTED_MODULE_0__.CanvasTileMapOptions),
/* harmony export */   "CanvasTileMapOptionsBuilder": () => (/* reexport safe */ _map_canvas__WEBPACK_IMPORTED_MODULE_0__.CanvasTileMapOptionsBuilder)
/* harmony export */ });
/* harmony import */ var _map_canvas__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./map.canvas */ "./dist/map/canvas/map.canvas.js");
/* harmony import */ var _map_canvas_display__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./map.canvas.display */ "./dist/map/canvas/map.canvas.display.js");
/* harmony import */ var _controller_canvas__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./controller.canvas */ "./dist/map/canvas/controller.canvas.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/map/canvas/map.canvas.display.js":
/*!***********************************************!*\
  !*** ./dist/map/canvas/map.canvas.display.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CanvasDisplay": () => (/* binding */ CanvasDisplay)
/* harmony export */ });
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geometry/geometry.size */ "./dist/geometry/geometry.size.js");

class CanvasDisplay {
    constructor(canvas) {
        this.canvas = canvas;
        this.resizeToDisplaySize();
    }
    getContext(options) {
        return this.canvas.getContext("2d", options);
    }
    get resolution() {
        return new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_0__.Size3(this.canvas.width, this.canvas.height, 0);
    }
    resizeToDisplaySize(scale = 1) {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        const ratio = window.devicePixelRatio;
        const w = displayWidth * ratio * scale;
        const h = displayHeight * ratio * scale;
        if (this.canvas.width != w || this.canvas.height != h) {
            this.canvas.width = w;
            this.canvas.height = h;
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=map.canvas.display.js.map

/***/ }),

/***/ "./dist/map/canvas/map.canvas.js":
/*!***************************************!*\
  !*** ./dist/map/canvas/map.canvas.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CanvasTileMap": () => (/* binding */ CanvasTileMap),
/* harmony export */   "CanvasTileMapOptions": () => (/* binding */ CanvasTileMapOptions),
/* harmony export */   "CanvasTileMapOptionsBuilder": () => (/* binding */ CanvasTileMapOptionsBuilder)
/* harmony export */ });
/* harmony import */ var _map__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../map */ "./dist/map/map.js");
/* harmony import */ var _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../geometry/geometry.rectangle */ "./dist/geometry/geometry.rectangle.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../math/math */ "./dist/math/math.js");
/* harmony import */ var _map_canvas_display__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./map.canvas.display */ "./dist/map/canvas/map.canvas.display.js");
/* harmony import */ var _math_math_color__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../math/math.color */ "./dist/math/math.color.js");
/* harmony import */ var _tiles_tiles_content_manager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../tiles/tiles.content.manager */ "./dist/tiles/tiles.content.manager.js");






class CanvasTileMapOptions {
    constructor(p) {
        Object.assign(this, p);
    }
}
CanvasTileMapOptions.DefaultBackColor = _math_math_color__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.LightGray();
CanvasTileMapOptions.DefaultForeColor = _math_math_color__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.Gray();
CanvasTileMapOptions.Default = new CanvasTileMapOptions({ backColor: CanvasTileMapOptions.DefaultBackColor, foreColor: CanvasTileMapOptions.DefaultForeColor });

class CanvasTileMapOptionsBuilder {
    withBackColor(v, g, b) {
        this._backColor = v instanceof _math_math_color__WEBPACK_IMPORTED_MODULE_0__.RGBAColor ? v : new _math_math_color__WEBPACK_IMPORTED_MODULE_0__.RGBAColor(v, g ?? 0, b ?? 0);
        return this;
    }
    withForeColor(v, g, b) {
        this._foreColor = v instanceof _math_math_color__WEBPACK_IMPORTED_MODULE_0__.RGBAColor ? v : new _math_math_color__WEBPACK_IMPORTED_MODULE_0__.RGBAColor(v, g ?? 0, b ?? 0);
        return this;
    }
    withFillEmptyFn(v) {
        this._fillEmpty = v;
        return this;
    }
    build() {
        return new CanvasTileMapOptions({ backColor: this._backColor, foreColor: this._foreColor, fillEmpty: this._fillEmpty });
    }
}
class CanvasTileMap extends _map__WEBPACK_IMPORTED_MODULE_1__.AbstractDisplayMap {
    constructor(canvas, datasource, center, lod, options) {
        super(new _map_canvas_display__WEBPACK_IMPORTED_MODULE_2__.CanvasDisplay(canvas), new _tiles_tiles_content_manager__WEBPACK_IMPORTED_MODULE_3__.TileContentManager(datasource), center, lod);
        this._options = { ...CanvasTileMapOptions.Default, ...options };
        this._observer = new ResizeObserver(() => {
            this.invalidateSize(canvas.width, canvas.height);
        });
        this._observer.observe(canvas);
    }
    onDeleted(key, tile) { }
    onAdded(key, tile) { }
    onUpdated(key, tile) { }
    invalidateTiles(added, removed) {
        if (added) {
            const ctx = this._display.getContext();
            if (ctx) {
                ctx.save();
                ctx.strokeStyle = this._options?.foreColor?.toString() ?? CanvasTileMapOptions.DefaultForeColor.toString();
                this.invalidate(ctx, added);
                ctx.restore();
            }
        }
    }
    invalidateDisplay(rect) {
        const ctx = this._display.getContext();
        if (ctx) {
            ctx.save();
            const res = this._display.resolution;
            rect = rect || new _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_4__.Rectangle(0, 0, res.width, res.height);
            ctx.fillStyle = this._options?.backColor?.toString() ?? CanvasTileMapOptions.DefaultBackColor.toString();
            ctx.strokeStyle = this._options?.foreColor?.toString() ?? CanvasTileMapOptions.DefaultForeColor.toString();
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            this.invalidate(ctx, this._activ.values());
            ctx.restore();
        }
    }
    invalidate(ctx, tiles) {
        if (ctx) {
            const scale = this._scale;
            const center = this._center;
            const res = this._display.resolution;
            ctx.translate(res.width / 2, res.height / 2);
            ctx.scale(scale, scale);
            if (this.azimuth) {
                const angle = this.azimuth * _math_math__WEBPACK_IMPORTED_MODULE_5__.Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            const tileSize = this.metrics.tileSize;
            for (const t of tiles) {
                if (t.rect) {
                    const x = t.rect.x - center.x;
                    const y = t.rect.y - center.y;
                    const item = t.content ?? null;
                    if (item) {
                        if (item instanceof HTMLImageElement) {
                            ctx.drawImage(item, x, y);
                            continue;
                        }
                    }
                    else {
                        if (this._options?.fillEmpty) {
                            this._options?.fillEmpty(ctx, x, y, tileSize, tileSize);
                            continue;
                        }
                        let s = tileSize;
                        ctx.strokeRect(x, y, s, s);
                    }
                }
            }
        }
    }
}
//# sourceMappingURL=map.canvas.js.map

/***/ }),

/***/ "./dist/map/geodetic.view.js":
/*!***********************************!*\
  !*** ./dist/map/geodetic.view.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GeodeticGridPainter": () => (/* binding */ GeodeticGridPainter),
/* harmony export */   "GeodeticGridView": () => (/* binding */ GeodeticGridView),
/* harmony export */   "GeodeticGridViewOptions": () => (/* binding */ GeodeticGridViewOptions)
/* harmony export */ });
/* harmony import */ var _math_math_color__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../math/math.color */ "./dist/math/math.color.js");

class GeodeticGridPainter {
    paint(ctx, rect, src, bounds) { }
}
GeodeticGridPainter.DefaultColor = new _math_math_color__WEBPACK_IMPORTED_MODULE_0__.RGBAColor(38, 222, 255);
GeodeticGridPainter.Default = new GeodeticGridPainter();

class GeodeticGridViewOptions {
}
GeodeticGridViewOptions.Default = new GeodeticGridViewOptions();

class GeodeticGridView {
    constructor(options) {
        this._o = { ...GeodeticGridViewOptions.Default, ...options };
    }
    invalidateContent(ctx, rect, src) {
        const envelope = src.view?.bounds;
        if (envelope) {
            const painter = (this._o.painters ? this._o.painters[src.levelOfDetail] : GeodeticGridPainter.Default) || GeodeticGridPainter.Default;
            painter.paint(ctx, rect, src, envelope);
        }
    }
}
//# sourceMappingURL=geodetic.view.js.map

/***/ }),

/***/ "./dist/map/index.js":
/*!***************************!*\
  !*** ./dist/map/index.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractDisplayMap": () => (/* reexport safe */ _map__WEBPACK_IMPORTED_MODULE_1__.AbstractDisplayMap),
/* harmony export */   "CanvasController": () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.CanvasController),
/* harmony export */   "CanvasDisplay": () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.CanvasDisplay),
/* harmony export */   "CanvasTileMap": () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.CanvasTileMap),
/* harmony export */   "CanvasTileMapOptions": () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.CanvasTileMapOptions),
/* harmony export */   "CanvasTileMapOptionsBuilder": () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.CanvasTileMapOptionsBuilder),
/* harmony export */   "GeodeticGridPainter": () => (/* reexport safe */ _geodetic_view__WEBPACK_IMPORTED_MODULE_2__.GeodeticGridPainter),
/* harmony export */   "GeodeticGridView": () => (/* reexport safe */ _geodetic_view__WEBPACK_IMPORTED_MODULE_2__.GeodeticGridView),
/* harmony export */   "GeodeticGridViewOptions": () => (/* reexport safe */ _geodetic_view__WEBPACK_IMPORTED_MODULE_2__.GeodeticGridViewOptions)
/* harmony export */ });
/* harmony import */ var _canvas_index__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./canvas/index */ "./dist/map/canvas/index.js");
/* harmony import */ var _map__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./map */ "./dist/map/map.js");
/* harmony import */ var _geodetic_view__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geodetic.view */ "./dist/map/geodetic.view.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/map/map.js":
/*!*************************!*\
  !*** ./dist/map/map.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractDisplayMap": () => (/* binding */ AbstractDisplayMap)
/* harmony export */ });
/* harmony import */ var _tiles_tiles_mapview__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles/tiles.mapview */ "./dist/tiles/tiles.mapview.js");
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography/geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geometry/geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _events_events_observable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../events/events.observable */ "./dist/events/events.observable.js");




class AbstractDisplayMap {
    constructor(display, manager, center, lod) {
        this._lod = 0;
        this._scale = 1;
        this._center = _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
        this._display = display;
        this._view = new _tiles_tiles_mapview__WEBPACK_IMPORTED_MODULE_1__.TileMapView(manager, display.resolution.width, display.resolution.height, center || _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__.Geo2.Zero(), lod || manager.metrics.minLOD);
        this._view.updateObservable.add(this.onUpdate.bind(this));
        this._activ = new Map();
    }
    get addedObservable() {
        this._addedObservable = this._addedObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_3__.Observable(this.onAddedObserverAdded.bind(this));
        return this._addedObservable;
    }
    get removedObservable() {
        this._removedObservable = this._removedObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_3__.Observable(this.onRemovedObserverAdded.bind(this));
        return this._removedObservable;
    }
    get updatedObservable() {
        this._updatedObservable = this._updatedObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_3__.Observable(this.onUpdatedObserverAdded.bind(this));
        return this._updatedObservable;
    }
    hasTile(key) {
        return this._activ.has(key);
    }
    getTile(key) {
        return this._activ.get(key);
    }
    invalidateSize(w, h) {
        this._view.invalidateSize(w, h);
        this._view.validate();
        return this;
    }
    setView(center, zoom, rotation) {
        this._view.setView(center, zoom, rotation);
        this._view.validate();
        return this;
    }
    setZoom(zoom) {
        this._view.setZoom(zoom);
        this._view.validate();
        return this;
    }
    setAzimuth(r) {
        this._view.setAzimuth(r);
        this._view.validate();
        return this;
    }
    zoomIn(delta) {
        this._view.zoomIn(delta ?? 1);
        this._view.validate();
        return this;
    }
    zoomOut(delta) {
        this._view.zoomOut(delta ?? 1);
        this._view.validate();
        return this;
    }
    translate(tx, ty) {
        this._view.translate(tx, ty);
        this._view.validate();
        return this;
    }
    rotate(r) {
        this._view.rotate(r);
        this._view.validate();
        return this;
    }
    get display() {
        return this._display;
    }
    get view() {
        return this._view;
    }
    get metrics() {
        return this.view.metrics;
    }
    get azimuth() {
        return this._view.azimuth;
    }
    onUpdate(args) {
        if (!args) {
            return;
        }
        switch (args.reason) {
            case _tiles_tiles_mapview__WEBPACK_IMPORTED_MODULE_1__.UpdateReason.tileReady: {
                this.onUpdateTiles(args);
                break;
            }
            case _tiles_tiles_mapview__WEBPACK_IMPORTED_MODULE_1__.UpdateReason.viewChanged:
            default: {
                this.onUpdateView(args);
                break;
            }
        }
    }
    onUpdateTiles(args) {
        this.processRemoved(args);
        const allocated = this.processAdded(args);
        this.invalidateTiles(allocated, args.removed);
    }
    onUpdateView(args) {
        this._lod = args.lod;
        this._scale = args.scale;
        this._center = args.center;
        this.processRemoved(args);
        this.processAdded(args);
        this.invalidateDisplay();
    }
    notifyRemovedObserver(tile) {
        if (this._removedObservable && this._removedObservable.hasObservers()) {
            this._removedObservable.notifyObservers(tile);
        }
    }
    notifyUpdatedObserver(tile) {
        if (this._updatedObservable && this._updatedObservable.hasObservers()) {
            this._updatedObservable.notifyObservers(tile);
        }
    }
    notifyAddedObserver(tile) {
        if (this._addedObservable && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers(tile);
        }
    }
    processRemoved(args) {
        if (args.removed && args.removed.length != 0) {
            for (const t of args.removed) {
                const key = t.address.quadkey;
                const old = this._activ.get(key);
                if (old) {
                    const mustDelete = true;
                    if (args.previousInfos) {
                        const lod = args.previousInfos.lod;
                        if (old.address.levelOfDetail != lod) {
                        }
                    }
                    if (mustDelete) {
                        this._activ.delete(key);
                        this.onDeleted(key, old);
                        this.notifyRemovedObserver(old);
                    }
                }
            }
        }
    }
    processAdded(args) {
        if (args.added && args.added.length != 0) {
            const toDisplay = [];
            for (const t of args.added) {
                const key = t.address.quadkey;
                let t1 = this._activ.get(key);
                if (t1) {
                    toDisplay.push(t1);
                    this.onUpdated(key, t1);
                    this.notifyUpdatedObserver(t1);
                    continue;
                }
                t1 = this.buildMapTile(t);
                toDisplay.push(t1);
                this._activ.set(key, t1);
                this.onAdded(key, t1);
                this.notifyAddedObserver(t1);
            }
            return toDisplay;
        }
        return undefined;
    }
    buildMapTile(t) {
        return t;
    }
    onAddedObserverAdded(observer) { }
    onRemovedObserverAdded(observer) { }
    onUpdatedObserverAdded(observer) { }
}
//# sourceMappingURL=map.js.map

/***/ }),

/***/ "./dist/math/index.js":
/*!****************************!*\
  !*** ./dist/math/index.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractRange": () => (/* reexport safe */ _math__WEBPACK_IMPORTED_MODULE_0__.AbstractRange),
/* harmony export */   "Angle": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Angle),
/* harmony export */   "Current": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Current),
/* harmony export */   "Distance": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Distance),
/* harmony export */   "HSLColor": () => (/* reexport safe */ _math_color__WEBPACK_IMPORTED_MODULE_2__.HSLColor),
/* harmony export */   "Luminosity": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Luminosity),
/* harmony export */   "Mass": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Mass),
/* harmony export */   "Power": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Power),
/* harmony export */   "Quantity": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Quantity),
/* harmony export */   "QuantityRange": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.QuantityRange),
/* harmony export */   "RGBAColor": () => (/* reexport safe */ _math_color__WEBPACK_IMPORTED_MODULE_2__.RGBAColor),
/* harmony export */   "Range": () => (/* reexport safe */ _math__WEBPACK_IMPORTED_MODULE_0__.Range),
/* harmony export */   "Scalar": () => (/* reexport safe */ _math__WEBPACK_IMPORTED_MODULE_0__.Scalar),
/* harmony export */   "Speed": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Speed),
/* harmony export */   "Temperature": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Temperature),
/* harmony export */   "Timespan": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Timespan),
/* harmony export */   "Unit": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Unit),
/* harmony export */   "Voltage": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Voltage),
/* harmony export */   "Volume": () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Volume)
/* harmony export */ });
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./math */ "./dist/math/math.js");
/* harmony import */ var _math_units__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./math.units */ "./dist/math/math.units.js");
/* harmony import */ var _math_color__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./math.color */ "./dist/math/math.color.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/math/math.color.js":
/*!*********************************!*\
  !*** ./dist/math/math.color.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HSLColor": () => (/* binding */ HSLColor),
/* harmony export */   "RGBAColor": () => (/* binding */ RGBAColor)
/* harmony export */ });
class RGBAColor {
    static White() {
        return new RGBAColor(255, 255, 255);
    }
    static Black() {
        return new RGBAColor(0, 0, 0);
    }
    static NeonBlue() {
        return new RGBAColor(77, 77, 255);
    }
    static LightGray() {
        return new RGBAColor(211, 211, 211);
    }
    static Gray() {
        return new RGBAColor(128, 128, 128);
    }
    constructor(r, g, b, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    toHSL() {
        const r = this.r / 255;
        const g = this.g / 255;
        const b = this.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s;
        const l = (max + min) / 2;
        if (max == min) {
            h = s = 0;
        }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
                default:
                    h = 0;
                    break;
            }
            h /= 6;
        }
        return new HSLColor(h, s, l);
    }
    interpolate(color, t, keepAlpha = true) {
        t = t || 0.5;
        const r = Math.round(this.r + t * (color.r - this.r));
        const g = Math.round(this.g + t * (color.g - this.g));
        const b = Math.round(this.b + t * (color.b - this.b));
        const a = keepAlpha ? this.a : Math.round(this.a + t * (color.a - this.a));
        return new RGBAColor(r, g, b, a);
    }
    interpolateInPlace(color, t, keepAlpha = true) {
        t = t || 0.5;
        this.r = Math.round(this.r + t * (color.r - this.r));
        this.g = Math.round(this.g + t * (color.g - this.g));
        this.b = Math.round(this.b + t * (color.b - this.b));
        this.a = keepAlpha ? this.a : Math.round(this.a + t * (color.a - this.a));
        return this;
    }
    toString() {
        return `rgb(${this.r},${this.g},${this.b})`;
    }
}
class HSLColor {
    static hue2rgb(p, q, t) {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }
    constructor(h, s, l) {
        this.h = h;
        this.s = s;
        this.l = l;
    }
    toRGB() {
        let l = this.l;
        if (this.s === 0) {
            l = Math.round(l * 255);
            return new RGBAColor(l, l, l);
        }
        const s = this.s;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = HSLColor.hue2rgb(p, q, this.h + 1 / 3);
        const g = HSLColor.hue2rgb(p, q, this.h);
        const b = HSLColor.hue2rgb(p, q, this.h - 1 / 3);
        return new RGBAColor(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
    }
}
//# sourceMappingURL=math.color.js.map

/***/ }),

/***/ "./dist/math/math.js":
/*!***************************!*\
  !*** ./dist/math/math.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractRange": () => (/* binding */ AbstractRange),
/* harmony export */   "Range": () => (/* binding */ Range),
/* harmony export */   "Scalar": () => (/* binding */ Scalar)
/* harmony export */ });
class Scalar {
    static WithinEpsilon(a, b, epsilon = Scalar.EPSILON) {
        const num = a - b;
        return -epsilon <= num && num <= epsilon;
    }
    static GetRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
Scalar.EPSILON = 1.401298e-45;
Scalar.DEG2RAD = Math.PI / 180;
Scalar.INCH2METER = 0.0254;
Scalar.METER2INCH = 39.3701;
Scalar.Sign = function (value) {
    return value > 0 ? 1 : -1;
};
Scalar.Clamp = function (value, min, max) {
    if (min === void 0) {
        min = 0;
    }
    if (max === void 0) {
        max = 1;
    }
    return Math.min(max, Math.max(min, value));
};

class AbstractRange {
    constructor(min, max) {
        this._min = min;
        this._max = max;
    }
    get min() {
        return this._min;
    }
    set min(m) {
        this._min = m;
        this._d = undefined;
    }
    get max() {
        return this._max;
    }
    set max(m) {
        this._max = m;
        this._d = undefined;
    }
    get delta() {
        if (this._d === undefined) {
            this._d = this.computeDelta(this._min, this._max);
        }
        return this._d;
    }
}
class Range extends AbstractRange {
    computeDelta(a, b) {
        return a && b ? b - a : Number.POSITIVE_INFINITY;
    }
}
//# sourceMappingURL=math.js.map

/***/ }),

/***/ "./dist/math/math.units.js":
/*!*********************************!*\
  !*** ./dist/math/math.units.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Angle": () => (/* binding */ Angle),
/* harmony export */   "Current": () => (/* binding */ Current),
/* harmony export */   "Distance": () => (/* binding */ Distance),
/* harmony export */   "Luminosity": () => (/* binding */ Luminosity),
/* harmony export */   "Mass": () => (/* binding */ Mass),
/* harmony export */   "Power": () => (/* binding */ Power),
/* harmony export */   "Quantity": () => (/* binding */ Quantity),
/* harmony export */   "QuantityRange": () => (/* binding */ QuantityRange),
/* harmony export */   "Speed": () => (/* binding */ Speed),
/* harmony export */   "Temperature": () => (/* binding */ Temperature),
/* harmony export */   "Timespan": () => (/* binding */ Timespan),
/* harmony export */   "Unit": () => (/* binding */ Unit),
/* harmony export */   "Voltage": () => (/* binding */ Voltage),
/* harmony export */   "Volume": () => (/* binding */ Volume)
/* harmony export */ });
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./math */ "./dist/math/math.js");

class Unit {
    constructor(name, symbol, value = 0, converter) {
        this.name = name;
        this.symbol = symbol;
        this.value = value;
        this.converter = converter;
    }
}
const _defaultDecimalPrecision = 6;
class Quantity {
    static round(value, decimalPrecision = _defaultDecimalPrecision) {
        const dp = decimalPrecision || _defaultDecimalPrecision;
        return Math.round(value * Math.pow(10, dp)) / Math.pow(10, dp);
    }
    constructor(value, unit) {
        if (value instanceof Quantity) {
            const q = value;
            this._value = q.value;
            this._unit = q._unit;
        }
        else {
            this._value = value;
            this._unit = unit;
        }
    }
    get unit() {
        return this._unit;
    }
    set unit(target) {
        if (target && this._unit && this._unit !== target) {
            this.tryConvert(target);
        }
    }
    get value() {
        return this._value;
    }
    set value(value) {
        this._value = value;
    }
    tryConvert(targetUnit) {
        if (this._unit) {
            if (this._unit.converter) {
                if (this._unit.converter.accept(this._unit) === false) {
                    return false;
                }
                this.value = this._unit.converter.convert(this.value, targetUnit);
                this._unit = targetUnit;
                return true;
            }
            if (targetUnit.value && targetUnit.symbol !== this._unit.symbol) {
                this.value *= this._unit.value / targetUnit.value;
                this._unit = targetUnit;
                return true;
            }
        }
        return false;
    }
    clone(unit) {
        const n = new (this.constructor(this._value, this._unit))();
        if (unit) {
            n.tryConvert(unit);
        }
        return n;
    }
    getValue(unit) {
        if (!this._unit) {
            return this._value;
        }
        if (unit && unit !== this._unit) {
            if (this._unit.converter) {
                if (this._unit.converter.accept(unit)) {
                    return this._unit.converter.convert(this.value, unit);
                }
            }
            if (unit.value && unit.symbol !== this._unit.symbol) {
                return this.value * (this._unit.value / unit.value);
            }
        }
        return this.value;
    }
    equals(v) {
        if (v._unit === this._unit) {
            return this.value === v.value;
        }
        return this.value === v.getValue(this._unit);
    }
    subtract(v) {
        const result = this.value - (v._unit === this._unit ? v.value : v.getValue(this._unit));
        return this.constructor(result, this._unit);
    }
    add(v) {
        const result = this.value + (v._unit === this._unit ? v.value : v.getValue(this._unit));
        return this.constructor(result, this._unit);
    }
    tryParse(str) {
        if (str) {
            const parts = str.split(" ");
            const v = parseFloat(str);
            if (Number.isNaN(v)) {
                return false;
            }
            this.value = v;
            if (parts.length > 1) {
                this._unit = this.unitForSymbol(parts[1]);
            }
            else {
                this._unit = undefined;
            }
            return true;
        }
        return false;
    }
}
class QuantityRange extends _math__WEBPACK_IMPORTED_MODULE_0__.AbstractRange {
    computeDelta(a, b) {
        return b && a ? b.subtract(a) : a.constructor(0, a.unit);
    }
}
class Timespan extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Timespan(value, defaultUnit) : new Timespan(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Timespan.Units[str] || undefined;
    }
}
Timespan.Units = {
    ys: new Unit("yoctosecond", "ys", 10e-24),
    zs: new Unit("zeptosecond", "zs", 10e-21),
    as: new Unit("attosecond", "as", 10e-18),
    fs: new Unit("femtosecond", "fs", 10e-15),
    ps: new Unit("picosecond", "ps", 10e-12),
    ns: new Unit("nanosecond", "ns", 10e-9),
    tick: new Unit("tick", "ns", 10e-7),
    mis: new Unit("microsecond", "mis", 10e-6),
    ms: new Unit("millisecond", "ms", 10e-3),
    s: new Unit("second", "s", 1),
    Min: new Unit("minute", "m", 60),
    Hour: new Unit("hour", "h", 3600),
    Day: new Unit("day", "d", 86400),
    Week: new Unit("week", "w", 86400 * 7),
    Yr: new Unit("year", "y", 86400 * 365.25),
    Cy: new Unit("century", "c", 86400 * 36525),
};

class KConverter {
    accept(unit) {
        return unit === Temperature.Units.c || unit === Temperature.Units.f;
    }
    convert(value, unit) {
        switch (unit) {
            case Temperature.Units.c:
                return value - Temperature.Units.k.value;
            case Temperature.Units.f:
                return (value - Temperature.Units.k.value) * 1.8 + 32;
            default:
                return value;
        }
    }
}
class CConverter {
    accept(unit) {
        return unit === Temperature.Units.k || unit === Temperature.Units.f;
    }
    convert(value, unit) {
        switch (unit) {
            case Temperature.Units.k:
                return value + Temperature.Units.k.value;
            case Temperature.Units.f:
                return value * 1.8 + 32;
            default:
                return value;
        }
    }
}
class FConverter {
    accept(unit) {
        return unit === Temperature.Units.k || unit === Temperature.Units.c;
    }
    convert(value, unit) {
        switch (unit) {
            case Temperature.Units.k:
                return (value - 32) / 1.8 + Temperature.Units.k.value;
            case Temperature.Units.c:
                return (value - 32) / 1.8;
            default:
                return value;
        }
    }
}
class Temperature extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Temperature(value, defaultUnit) : new Temperature(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Temperature.Units[str] || undefined;
    }
}
Temperature.Units = {
    k: new Unit("kelvin", "k", -273.15, new KConverter()),
    c: new Unit("celsius", "c", 1, new CConverter()),
    f: new Unit("fahrenheit", "f", 33.8, new FConverter()),
};

class Mass extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Mass(value, defaultUnit) : new Mass(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Mass.Units[str] || undefined;
    }
}
Mass.Units = {
    u: new Unit("atomic mass unit", "u", 1.66e-27),
    pm: new Unit("plank mass", "pm", 1e-8),
    mg: new Unit("microgram", "µg", 1e-6),
    g: new Unit("gram", "g", 1e-3),
    pound: new Unit("pound", "lb", 0.45359237),
    kg: new Unit("kilogram", "kg", 1),
    T: new Unit("Ton", "T", 1000),
    Sm: new Unit("solar mass", "Sm", 1.98855e30),
};

class Power extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Power(value, defaultUnit) : new Power(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Power.Units[str] || undefined;
    }
}
Power.Units = {
    watt: new Unit("watt", "w", 1),
    Kwatt: new Unit("Kwatt", "kw", 1000),
};

class Voltage extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Voltage(value, defaultUnit) : new Voltage(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Voltage.Units[str] || undefined;
    }
}
Voltage.Units = {
    volt: new Unit("volt", "v", 1),
};

class Current extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Current(value, defaultUnit) : new Current(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Current.Units[str] || undefined;
    }
}
Current.Units = {
    amp: new Unit("amp", "a", 1),
};

class Luminosity extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Luminosity(value, defaultUnit) : new Luminosity(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Luminosity.Units[str] || undefined;
    }
}
Luminosity.Units = {
    watt: new Unit("watt", "w", 1),
    Lsun: new Unit("solar luminosity", "Lsun", 3.846e26),
};

class Volume extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Volume(value, defaultUnit) : new Volume(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Volume.Units[str] || undefined;
    }
}
Volume.Units = {
    m3: new Unit("cubic meter", "m3", 1),
};

class Angle extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Angle(value, defaultUnit) : new Angle(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Angle.Units[str] || undefined;
    }
}
Angle.PIBY2 = Math.PI / 2;
Angle.PIBY4 = Math.PI / 4;
Angle.DE2RA = Math.PI / 180;
Angle.RA2DE = 180 / Math.PI;
Angle.DE2RABY2 = Math.PI / 360;
Angle.Units = {
    d: new Unit("degre", "d", 1),
    r: new Unit("radian", "r", Angle.RA2DE),
};

class Distance extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Distance(value, defaultUnit) : new Distance(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Distance.Units[str] || undefined;
    }
}
Distance.Units = {
    ym: new Unit("yoctometer", "ym", 10e-24),
    zm: new Unit("zeptometer", "zm", 10e-21),
    am: new Unit("attometer", "am", 10e-18),
    fm: new Unit("femtometer", "fm", 10e-15),
    pm: new Unit("picometer", "pm", 10e-12),
    nm: new Unit("nanometer", "nm", 10e-9),
    mim: new Unit("micrometer", "mim", 10e-6),
    mm: new Unit("millimeter", "mm", 10e-3),
    cm: new Unit("centimeter", "cm", 10e-2),
    dm: new Unit("decimeter", "dm", 10e-1),
    m: new Unit("meter", "m", 1),
    Mi: new Unit("mile", "Mi", 1.609343502101154),
    Nmi: new Unit("nmile", "Nmi", 1.8519994270282407189),
    Dam: new Unit("decameter", "Dm", 10),
    Hm: new Unit("hectometer", "Hm", 100),
    Km: new Unit("kilometer", "Km", 1000),
    Sr: new Unit("solar radius", "Sr", 6957e5),
    Mm: new Unit("megameter", "Mn", 10e6),
    Ls: new Unit("light second", "Ls", 299792458),
    Gm: new Unit("gigameter", "Gm", 10e9),
    Au: new Unit("astronomical unit", "Au", 1.496e11),
    Tm: new Unit("terameter", "Tm", 10e12),
    Pm: new Unit("petameter", "Pm", 10e15),
    Ly: new Unit("light year", "Ly", 9.4607e15),
    Pc: new Unit("parsec", "Pc", 3.0857e16),
    Em: new Unit("exameter", "Em", 10e18),
    Zm: new Unit("zettameter", "Zm", 10e21),
    Ym: new Unit("yottameter", "Ym", 10e24),
};

class Speed extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Distance(value, defaultUnit) : new Distance(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Speed.Units[str] || undefined;
    }
}
Speed.Units = {};

//# sourceMappingURL=math.units.js.map

/***/ }),

/***/ "./dist/meshes/index.js":
/*!******************************!*\
  !*** ./dist/meshes/index.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TerrainGridOptions": () => (/* reexport safe */ _terrain_grid__WEBPACK_IMPORTED_MODULE_0__.TerrainGridOptions),
/* harmony export */   "TerrainGridOptionsBuilder": () => (/* reexport safe */ _terrain_grid__WEBPACK_IMPORTED_MODULE_0__.TerrainGridOptionsBuilder),
/* harmony export */   "TerrainNormalizedGridBuilder": () => (/* reexport safe */ _terrain_grid__WEBPACK_IMPORTED_MODULE_0__.TerrainNormalizedGridBuilder)
/* harmony export */ });
/* harmony import */ var _terrain_grid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./terrain.grid */ "./dist/meshes/terrain.grid.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/meshes/terrain.grid.js":
/*!*************************************!*\
  !*** ./dist/meshes/terrain.grid.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TerrainGridOptions": () => (/* binding */ TerrainGridOptions),
/* harmony export */   "TerrainGridOptionsBuilder": () => (/* binding */ TerrainGridOptionsBuilder),
/* harmony export */   "TerrainNormalizedGridBuilder": () => (/* binding */ TerrainNormalizedGridBuilder)
/* harmony export */ });
class TerrainGridOptions {
    constructor(p) {
        Object.assign(this, p);
    }
    clone() {
        return new TerrainGridOptions(this);
    }
}
TerrainGridOptions.DefaultGridSize = 256;
TerrainGridOptions.DefaultInvertIndices = false;
TerrainGridOptions.DefaultScale = 1;
TerrainGridOptions.Shared = new TerrainGridOptions({
    columns: TerrainGridOptions.DefaultGridSize,
});

class TerrainGridOptionsBuilder {
    withUvs(flag) {
        this._uvs = flag;
        return this;
    }
    withColumns(v) {
        this._cols = v;
        return this;
    }
    withRows(v) {
        this._rows = v;
        return this;
    }
    withInvertIndices(v) {
        this._invertIndices = v;
        return this;
    }
    withInvertYZ(v) {
        this._invertYZ = v;
        return this;
    }
    withScale(x, y) {
        this._sx = x;
        this._sy = y || x;
        return this;
    }
    withOffset(x, y) {
        this._ox = x;
        this._oy = y || x;
        return this;
    }
    withZInitializer(zinit) {
        this._zInitializer = zinit;
        return this;
    }
    withUVInitializer(uvinit) {
        this._uvInitializer = uvinit;
        return this;
    }
    build() {
        return new TerrainGridOptions({
            uvs: this._uvs,
            columns: this._cols || this._rows,
            rows: this._rows || this._cols,
            sx: this._sx,
            sy: this._sy,
            invertIndices: this._invertIndices,
            zInitializer: this._zInitializer,
            uvInitializer: this._uvInitializer,
        });
    }
}
class TerrainNormalizedGridBuilder {
    constructor(options = null) {
        this.withOptions(options);
    }
    withOptions(options) {
        this._o = { ...TerrainGridOptions.Shared, ...options };
        return this;
    }
    build(data, ...params) {
        data = data || {};
        const w = this._o?.columns || TerrainGridOptions.DefaultGridSize;
        const h = this._o?.rows || w;
        const sx = this._o?.sx || TerrainGridOptions.DefaultScale;
        const sy = this._o?.sy || TerrainGridOptions.DefaultScale;
        const ox = this._o?.ox || 0;
        const oy = this._o?.oy || 0;
        const positions = [];
        const indices = [];
        const uvs = this._o?.uvs ? [] : null;
        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);
        const x0 = -0.5 + ox * dx;
        const y0 = 0.5 + oy * dy;
        for (let row = 0; row < h; row++) {
            const v = row * dy;
            const y = (y0 - v) * sy;
            for (let column = 0; column < w; column++) {
                const u = column * dx;
                const x = (x0 + u) * sx;
                const z = this._o?.zInitializer ? this._o.zInitializer(column, row, w, h, ...params) : 0;
                positions.push(x, y, z);
                if (uvs) {
                    const uv = this._o?.uvInitializer ? this._o.uvInitializer(column, row, w, h, ...params) : [u, v];
                    uvs.push(...uv);
                }
            }
        }
        const isWEven = w % 2 == 0;
        for (let row = 0; row < h - 1; row++) {
            const indice = isWEven ? row % 2 : 0;
            const offset = row * w;
            for (let col = 0; col < w - 1; col++) {
                const idx1 = offset + col;
                const idx2 = idx1 + w;
                const idx3 = idx2 + 1;
                const idx4 = idx1 + 1;
                if (idx1 % 2 != indice) {
                    if (this._o?.invertIndices) {
                        indices.push(idx1, idx2, idx4, idx2, idx3, idx4);
                    }
                    else {
                        indices.push(idx1, idx4, idx2, idx2, idx4, idx3);
                    }
                }
                else {
                    if (this._o?.invertIndices) {
                        indices.push(idx1, idx2, idx3, idx3, idx4, idx1);
                    }
                    else {
                        indices.push(idx1, idx3, idx2, idx3, idx1, idx4);
                    }
                }
            }
        }
        data.indices = indices;
        data.positions = positions;
        data.uvs = uvs;
        return data;
    }
}
//# sourceMappingURL=terrain.grid.js.map

/***/ }),

/***/ "./dist/space/index.js":
/*!*****************************!*\
  !*** ./dist/space/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AxialTilt": () => (/* reexport safe */ _space_axialTilt__WEBPACK_IMPORTED_MODULE_0__.AxialTilt),
/* harmony export */   "CelestialNodeType": () => (/* reexport safe */ _space_interfaces__WEBPACK_IMPORTED_MODULE_1__.CelestialNodeType),
/* harmony export */   "ColorValue": () => (/* reexport safe */ _space_starColor__WEBPACK_IMPORTED_MODULE_3__.ColorValue),
/* harmony export */   "KeplerOrbitBase": () => (/* reexport safe */ _space_kepler__WEBPACK_IMPORTED_MODULE_4__.KeplerOrbitBase),
/* harmony export */   "MorganKeenanClass": () => (/* reexport safe */ _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__.MorganKeenanClass),
/* harmony export */   "SpectralClass": () => (/* reexport safe */ _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__.SpectralClass),
/* harmony export */   "StarColor": () => (/* reexport safe */ _space_starColor__WEBPACK_IMPORTED_MODULE_3__.StarColor)
/* harmony export */ });
/* harmony import */ var _space_axialTilt__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.axialTilt */ "./dist/space/space.axialTilt.js");
/* harmony import */ var _space_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./space.interfaces */ "./dist/space/space.interfaces.js");
/* harmony import */ var _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./space.spectralClass */ "./dist/space/space.spectralClass.js");
/* harmony import */ var _space_starColor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./space.starColor */ "./dist/space/space.starColor.js");
/* harmony import */ var _space_kepler__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./space.kepler */ "./dist/space/space.kepler.js");





//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/space/space.axialTilt.js":
/*!***************************************!*\
  !*** ./dist/space/space.axialTilt.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AxialTilt": () => (/* binding */ AxialTilt)
/* harmony export */ });
/* harmony import */ var _math_math_units__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../math/math.units */ "./dist/math/math.units.js");

class AxialTilt {
    constructor(obliquity, period) {
        this._obliquity = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(obliquity, AxialTilt.defaultAngleUnit);
        this._period = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan(period, AxialTilt.defaultPeriodUnit);
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
AxialTilt.defaultAngleUnit = _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d;
AxialTilt.defaultPeriodUnit = _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan.Units.s;

//# sourceMappingURL=space.axialTilt.js.map

/***/ }),

/***/ "./dist/space/space.interfaces.js":
/*!****************************************!*\
  !*** ./dist/space/space.interfaces.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CelestialNodeType": () => (/* binding */ CelestialNodeType)
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

/***/ }),

/***/ "./dist/space/space.kepler.js":
/*!************************************!*\
  !*** ./dist/space/space.kepler.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "KeplerOrbitBase": () => (/* binding */ KeplerOrbitBase)
/* harmony export */ });
/* harmony import */ var _math_math_units__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../math/math.units */ "./dist/math/math.units.js");

class KeplerOrbitBase {
    constructor(body, focus, semiMajorAxis, eccentricity = 0, periapsisTime = 0, inclination, ascendingNodeLongitude, periapsisAngle, period) {
        this._body = body;
        this._focus = focus;
        this._semiMajorAxis = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(semiMajorAxis, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Ly);
        this._eccentricity = eccentricity;
        this._periapsisTime = periapsisTime;
        this._inclination = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(inclination, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d);
        this._ascendingNodeLongitude = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(ascendingNodeLongitude, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d);
        this._periapsisAngle = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle(periapsisAngle, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Angle.Units.d);
        this._period = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan(period, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Timespan.Units.Yr);
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
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(v, this._semiMajorAxis.unit);
    }
    get periapsis() {
        const v = this.semiMajorAxis.value * (1.0 - this._eccentricity);
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(v, this._semiMajorAxis.unit);
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
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(v, this._semiMajorAxis.unit);
    }
    get meanAngularSpeed() {
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Speed(360.0 / this._period.value);
    }
    getEccentricAnomaly(meanAnomaly, decimalPrecision) {
        const dp = decimalPrecision || KeplerOrbitBase.DefaultDecimalPrecision;
        const K = Math.PI / 180.0;
        let m = meanAnomaly / 360.0;
        m = 2.0 * Math.PI * (m - Math.floor(m));
        let E = this._eccentricity < 0.8 ? m : Math.PI;
        let F = E - this._eccentricity * Math.sin(m) - m;
        const maxIteration = KeplerOrbitBase.DefaultIterationLimit;
        const delta = Math.pow(10, -dp);
        let i = 0;
        while (Math.abs(F) > delta && i++ < maxIteration) {
            E -= F / (1.0 - this._eccentricity * Math.cos(E));
            F = E - this._eccentricity * Math.sin(E) - m;
        }
        E /= K;
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(Math.round(E * Math.pow(10, dp)) / Math.pow(10, dp));
    }
}
KeplerOrbitBase.DefaultDecimalPrecision = 5;
KeplerOrbitBase.DefaultIterationLimit = 30;

//# sourceMappingURL=space.kepler.js.map

/***/ }),

/***/ "./dist/space/space.spectralClass.js":
/*!*******************************************!*\
  !*** ./dist/space/space.spectralClass.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MorganKeenanClass": () => (/* binding */ MorganKeenanClass),
/* harmony export */   "SpectralClass": () => (/* binding */ SpectralClass)
/* harmony export */ });
/* harmony import */ var _math_math_units__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../math/math.units */ "./dist/math/math.units.js");

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

class SpectralClass {
    static ClassFromTemperature(temperature) {
        const temp = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(temperature, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k);
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
SpectralClass.O = new SpectralClass("O", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(60000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "blue", "blue", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(16, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(6.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 0.00003);
SpectralClass.B = new SpectralClass("B", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(10000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "blue white", "deep blue white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(2.1, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(16, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(1.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(6.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(25, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 0.13);
SpectralClass.A = new SpectralClass("A", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(7500, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(10000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "white", "blue white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(2.1, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(1.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(25, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "strong", 0.6);
SpectralClass.F = new SpectralClass("F", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(6000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(7500, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "yellow white", "white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.04, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(1.15, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(1.5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "medium", 3);
SpectralClass.G = new SpectralClass("G", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(5200, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(6000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "yellow", "yello white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.04, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(0.96, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(1.15, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(1.5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 7.6);
SpectralClass.K = new SpectralClass("K", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(3700, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(5200, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "orange	pale", "yello orange", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.45, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(0.7, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(0.96, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.08, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "very weak", 12.1);
SpectralClass.M = new SpectralClass("M", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(2400, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(3700, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "red light", "orange red", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.08, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.45, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(0, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance(0.7, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Distance.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "very weak", 76.45);
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
SpectralClass.TemperatureRange = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(2400, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(60000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k));

//# sourceMappingURL=space.spectralClass.js.map

/***/ }),

/***/ "./dist/space/space.starColor.js":
/*!***************************************!*\
  !*** ./dist/space/space.starColor.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ColorValue": () => (/* binding */ ColorValue),
/* harmony export */   "StarColor": () => (/* binding */ StarColor)
/* harmony export */ });
/* harmony import */ var _space_spectralClass__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.spectralClass */ "./dist/space/space.spectralClass.js");
/* harmony import */ var _math_math_units__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../math/math.units */ "./dist/math/math.units.js");
/* harmony import */ var _math_math_color__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../math/math.color */ "./dist/math/math.color.js");



class ColorValue {
    constructor(mk, sclass, kelvin, color) {
        this.mk = mk;
        this.sclass = sclass;
        this.kelvin = kelvin;
        this.color = color;
    }
}
class StarColor {
    static _buildIndex(ColorTable) {
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
                yield { mk: c, sclass: sc, kelvin: min.value + delta.value * t, color: new _math_math_color__WEBPACK_IMPORTED_MODULE_1__.RGBAColor(r, g, b) };
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
        const kelvin = new _math_math_units__WEBPACK_IMPORTED_MODULE_2__.Temperature(temperature, _math_math_units__WEBPACK_IMPORTED_MODULE_2__.Temperature.Units.k);
        const i = this._lookupIndexes(luminosity, kelvin.value);
        if (!i || !i.length)
            return new _math_math_color__WEBPACK_IMPORTED_MODULE_1__.RGBAColor(0, 0, 0);
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
StarColor.Matrix = StarColor._buildIndex(StarColor.ColorTable);

//# sourceMappingURL=space.starColor.js.map

/***/ }),

/***/ "./dist/tiles/index.js":
/*!*****************************!*\
  !*** ./dist/tiles/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractTileMetrics": () => (/* reexport safe */ _tiles_metrics__WEBPACK_IMPORTED_MODULE_2__.AbstractTileMetrics),
/* harmony export */   "BlobTileCodec": () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_5__.BlobTileCodec),
/* harmony export */   "CellCoordinateReference": () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.CellCoordinateReference),
/* harmony export */   "ContentUpdateEventArgs": () => (/* reexport safe */ _tiles_content_manager__WEBPACK_IMPORTED_MODULE_11__.ContentUpdateEventArgs),
/* harmony export */   "EPSG3857": () => (/* reexport safe */ _tiles_geography__WEBPACK_IMPORTED_MODULE_6__.EPSG3857),
/* harmony export */   "FetchError": () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_3__.FetchError),
/* harmony export */   "FetchResult": () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.FetchResult),
/* harmony export */   "Float32TileCodec": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.Float32TileCodec),
/* harmony export */   "Float32TileCodecOptions": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.Float32TileCodecOptions),
/* harmony export */   "Float32TileCodecOptionsBuilder": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.Float32TileCodecOptionsBuilder),
/* harmony export */   "Google": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.Google),
/* harmony export */   "GoogleMap2DLayerCode": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.GoogleMap2DLayerCode),
/* harmony export */   "GoogleMap2DUrlBuilder": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.GoogleMap2DUrlBuilder),
/* harmony export */   "ImageDataTileCodec": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.ImageDataTileCodec),
/* harmony export */   "ImageDataTileCodecOptions": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.ImageDataTileCodecOptions),
/* harmony export */   "ImageDataTileCodecOptionsBuilder": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.ImageDataTileCodecOptionsBuilder),
/* harmony export */   "ImageTileCodec": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.ImageTileCodec),
/* harmony export */   "IsTileContentView": () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsTileContentView),
/* harmony export */   "JsonTileCodec": () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_5__.JsonTileCodec),
/* harmony export */   "LODTransitionMode": () => (/* reexport safe */ _tiles_mapview__WEBPACK_IMPORTED_MODULE_10__.LODTransitionMode),
/* harmony export */   "MapBox": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.MapBox),
/* harmony export */   "MapBoxTerrainDemV1UrlBuilder": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   "MapZen": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.MapZen),
/* harmony export */   "MapZenDemUrlBuilder": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.MapZenDemUrlBuilder),
/* harmony export */   "MapboxAltitudeDecoder": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.MapboxAltitudeDecoder),
/* harmony export */   "MapzenAltitudeDecoder": () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_7__.MapzenAltitudeDecoder),
/* harmony export */   "RGBATileCodec": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.RGBATileCodec),
/* harmony export */   "RGBTileCodec": () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__.RGBTileCodec),
/* harmony export */   "TextTileCodec": () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_5__.TextTileCodec),
/* harmony export */   "Tile": () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_8__.Tile),
/* harmony export */   "TileAddress": () => (/* reexport safe */ _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress),
/* harmony export */   "TileBuilder": () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_8__.TileBuilder),
/* harmony export */   "TileContentManager": () => (/* reexport safe */ _tiles_content_manager__WEBPACK_IMPORTED_MODULE_11__.TileContentManager),
/* harmony export */   "TileContentView": () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_8__.TileContentView),
/* harmony export */   "TileMapContext": () => (/* reexport safe */ _tiles_mapview__WEBPACK_IMPORTED_MODULE_10__.TileMapContext),
/* harmony export */   "TileMapView": () => (/* reexport safe */ _tiles_mapview__WEBPACK_IMPORTED_MODULE_10__.TileMapView),
/* harmony export */   "TileMetrics": () => (/* reexport safe */ _tiles_metrics__WEBPACK_IMPORTED_MODULE_2__.TileMetrics),
/* harmony export */   "TileMetricsOptions": () => (/* reexport safe */ _tiles_metrics__WEBPACK_IMPORTED_MODULE_2__.TileMetricsOptions),
/* harmony export */   "TileMetricsOptionsBuilder": () => (/* reexport safe */ _tiles_metrics__WEBPACK_IMPORTED_MODULE_2__.TileMetricsOptionsBuilder),
/* harmony export */   "TileWebClient": () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_3__.TileWebClient),
/* harmony export */   "TileWebClientOptions": () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_3__.TileWebClientOptions),
/* harmony export */   "TileWebClientOptionsBuilder": () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_3__.TileWebClientOptionsBuilder),
/* harmony export */   "UpdateEventArgs": () => (/* reexport safe */ _tiles_mapview__WEBPACK_IMPORTED_MODULE_10__.UpdateEventArgs),
/* harmony export */   "UpdateInfos": () => (/* reexport safe */ _tiles_mapview__WEBPACK_IMPORTED_MODULE_10__.UpdateInfos),
/* harmony export */   "UpdateReason": () => (/* reexport safe */ _tiles_mapview__WEBPACK_IMPORTED_MODULE_10__.UpdateReason),
/* harmony export */   "WebTileUrlBuilder": () => (/* reexport safe */ _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_9__.WebTileUrlBuilder),
/* harmony export */   "XmlDocumentTileCodec": () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_5__.XmlDocumentTileCodec),
/* harmony export */   "isTileAddress": () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.isTileAddress)
/* harmony export */ });
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _tiles_address__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.address */ "./dist/tiles/tiles.address.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _tiles_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./tiles.client */ "./dist/tiles/tiles.client.js");
/* harmony import */ var _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./tiles.codecs.image */ "./dist/tiles/tiles.codecs.image.js");
/* harmony import */ var _tiles_codecs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./tiles.codecs */ "./dist/tiles/tiles.codecs.js");
/* harmony import */ var _tiles_geography__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./tiles.geography */ "./dist/tiles/tiles.geography.js");
/* harmony import */ var _vendors_index__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./vendors/index */ "./dist/tiles/vendors/index.js");
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./tiles */ "./dist/tiles/tiles.js");
/* harmony import */ var _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./tiles.urlBuilder */ "./dist/tiles/tiles.urlBuilder.js");
/* harmony import */ var _tiles_mapview__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./tiles.mapview */ "./dist/tiles/tiles.mapview.js");
/* harmony import */ var _tiles_content_manager__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./tiles.content.manager */ "./dist/tiles/tiles.content.manager.js");












//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/tiles.address.js":
/*!*************************************!*\
  !*** ./dist/tiles/tiles.address.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TileAddress": () => (/* binding */ TileAddress)
/* harmony export */ });
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.metrics */ "./dist/tiles/tiles.metrics.js");

class TileAddress {
    constructor(x, y, levelOfDetail) {
        this.x = x;
        this.y = y;
        this.levelOfDetail = levelOfDetail;
    }
    get quadkey() {
        if (!this._k) {
            this._k = _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__.TileMetrics.TileXYToQuadKey(this);
        }
        return this._k;
    }
    toString() {
        return `x:${this.x}, y:${this.y}, lod:${this.levelOfDetail}, k:${this.quadkey}`;
    }
}
//# sourceMappingURL=tiles.address.js.map

/***/ }),

/***/ "./dist/tiles/tiles.client.js":
/*!************************************!*\
  !*** ./dist/tiles/tiles.client.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FetchError": () => (/* binding */ FetchError),
/* harmony export */   "TileWebClient": () => (/* binding */ TileWebClient),
/* harmony export */   "TileWebClientOptions": () => (/* binding */ TileWebClientOptions),
/* harmony export */   "TileWebClientOptionsBuilder": () => (/* binding */ TileWebClientOptionsBuilder)
/* harmony export */ });
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../math/math */ "./dist/math/math.js");


class TileWebClientOptions {
    constructor(p) {
        Object.assign(this, p);
    }
}
TileWebClientOptions.Default = new TileWebClientOptions({ maxRetry: 3, initialDelay: 1000 });

class TileWebClientOptionsBuilder {
    withMaxRetry(v) {
        this._maxRetry = v;
        return this;
    }
    withInitialDelay(v) {
        this._initialDelay = v;
        return this;
    }
    build() {
        return new TileWebClientOptions({ maxRetry: this._maxRetry, initialDelay: this._initialDelay });
    }
}
class FetchError extends Error {
    constructor(message, ...userArgs) {
        super(message);
        this.userArgs = userArgs;
    }
}
class TileWebClient {
    constructor(urlFactory, codec, metrics, options) {
        if (!urlFactory) {
            throw new Error(`invalid url factory parameter ${urlFactory}`);
        }
        if (!codec) {
            throw new Error(`invalid codec parameter ${codec}`);
        }
        this._urlFactory = urlFactory;
        this._codec = codec;
        this._metrics = metrics;
        this._o = { ...TileWebClientOptions.Default, ...options };
    }
    get metrics() {
        return this._metrics;
    }
    async fetchAsync(request, ...userArgs) {
        if (!request) {
            throw new FetchError(`invalid request parameter ${request}`, ...userArgs);
        }
        const url = this._urlFactory.buildUrl(request, ...userArgs);
        if (!url) {
            throw new FetchError(`Builded url of ${request.toString()} can not be null`, ...userArgs);
        }
        const maxRetry = this._o.maxRetry || 1;
        let delay = this._o.initialDelay || 1000;
        let retryCount = 0;
        do {
            try {
                const response = await fetch(url);
                let content = null;
                if (response.ok) {
                    content = await this._codec.decodeAsync(response);
                }
                else {
                    console.log(`Failed ${url}: ${response.status}`);
                }
                const r = new _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.FetchResult(request, content, userArgs);
                r.status = response.status;
                r.statusText = response.statusText;
                return r;
            }
            catch (error) {
                console.log(`Error fetching ${url}: ${error}`);
            }
            const jitter = _math_math__WEBPACK_IMPORTED_MODULE_1__.Scalar.GetRandomInt(0, this._o.initialDelay || 1000);
            await new Promise((resolve) => setTimeout(resolve, delay + jitter));
            delay *= 2;
            retryCount++;
        } while (retryCount < maxRetry);
        throw new FetchError(`Exceeded maximum retries for URL: ${url}`, ...userArgs);
    }
}
//# sourceMappingURL=tiles.client.js.map

/***/ }),

/***/ "./dist/tiles/tiles.codecs.image.js":
/*!******************************************!*\
  !*** ./dist/tiles/tiles.codecs.image.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Float32TileCodec": () => (/* binding */ Float32TileCodec),
/* harmony export */   "Float32TileCodecOptions": () => (/* binding */ Float32TileCodecOptions),
/* harmony export */   "Float32TileCodecOptionsBuilder": () => (/* binding */ Float32TileCodecOptionsBuilder),
/* harmony export */   "ImageDataTileCodec": () => (/* binding */ ImageDataTileCodec),
/* harmony export */   "ImageDataTileCodecOptions": () => (/* binding */ ImageDataTileCodecOptions),
/* harmony export */   "ImageDataTileCodecOptionsBuilder": () => (/* binding */ ImageDataTileCodecOptionsBuilder),
/* harmony export */   "ImageTileCodec": () => (/* binding */ ImageTileCodec),
/* harmony export */   "RGBATileCodec": () => (/* binding */ RGBATileCodec),
/* harmony export */   "RGBTileCodec": () => (/* binding */ RGBTileCodec)
/* harmony export */ });
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! .. */ "./dist/geometry/geometry.interfaces.js");

class ImageTileCodec {
    async decodeAsync(r) {
        const blob = r instanceof Response ? await r.blob() : null;
        if (blob) {
            return new Promise((resolve, reject) => {
                try {
                    const img = new Image();
                    const blobURL = URL.createObjectURL(blob);
                    img.onload = function (ev) {
                        const e = ev.target;
                        if (e && e instanceof HTMLImageElement) {
                            URL.revokeObjectURL(e.src);
                            e.onload = null;
                        }
                        resolve(img);
                    };
                    img.onerror = reject;
                    img.src = blobURL;
                }
                catch (e) {
                    reject(e);
                }
            });
        }
        else {
            return null;
        }
    }
}
ImageTileCodec.Shared = new ImageTileCodec();

class ImageDataTileCodecOptions {
    constructor(p) {
        Object.assign(this, p);
    }
}
class ImageDataTileCodecOptionsBuilder {
    withInsets(v, side) {
        this._insets = this._insets ?? [0, 0, 0, 0];
        this._insets[side] = v;
        return this;
    }
    build() {
        return new ImageDataTileCodecOptions({
            insets: this._insets,
        });
    }
}
class ImageDataTileCodec {
    static CreateCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    constructor(canvas, options) {
        this._canvas = canvas;
        this._options = options;
    }
    async decodeAsync(r) {
        const image = await ImageTileCodec.Shared.decodeAsync(r);
        if (image) {
            const insets = this._options?.insets ?? [0, 0, 0, 0];
            const w = image.width - (insets[___WEBPACK_IMPORTED_MODULE_0__.Side.left] + insets[___WEBPACK_IMPORTED_MODULE_0__.Side.right]);
            const h = image.height - (insets[___WEBPACK_IMPORTED_MODULE_0__.Side.top] + insets[___WEBPACK_IMPORTED_MODULE_0__.Side.bottom]);
            const workingCanvas = this._canvas || ImageDataTileCodec.CreateCanvas(w, h);
            if (!workingCanvas) {
                throw new Error("Unable to create 2d canvas");
            }
            const workingContext = workingCanvas.getContext("2d");
            if (!workingContext) {
                throw new Error("Unable to get 2d context");
            }
            workingContext.clearRect(0, 0, w, h);
            const sx = insets[___WEBPACK_IMPORTED_MODULE_0__.Side.left];
            const sy = insets[___WEBPACK_IMPORTED_MODULE_0__.Side.top];
            workingContext.drawImage(image, sx, sy, w, h, 0, 0, w, h);
            return workingContext.getImageData(0, 0, w, h);
        }
        return null;
    }
}
ImageDataTileCodec.Shared = new ImageDataTileCodec();

class RGBTileCodec {
    constructor(canvas) {
        this._canvas = canvas;
    }
    async decodeAsync(r) {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            const size = imgData.width * imgData.height;
            const n = pixels.length / size;
            if (n == 4) {
                const a = new Uint8ClampedArray(size * 3);
                for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
                    a[j] = pixels[i];
                    a[j + 1] = pixels[i + 1];
                    a[j + 2] = pixels[i + 2];
                }
                return a;
            }
            return pixels;
        }
        return null;
    }
}
class RGBATileCodec {
    constructor(canvas) {
        this._canvas = canvas;
    }
    async decodeAsync(r) {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            return pixels;
        }
        return null;
    }
}
class Float32TileCodecOptions extends ImageDataTileCodecOptions {
    constructor(p) {
        super(p);
    }
}
class Float32TileCodecOptionsBuilder extends ImageDataTileCodecOptionsBuilder {
}
class Float32TileCodec {
    constructor(pixelDecoder, options, canvas) {
        this.pixelDecoder = pixelDecoder;
        this._options = options;
        this._canvas = canvas;
    }
    async decodeAsync(r) {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas, this._options) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            const w = imgData.width;
            const h = imgData.height;
            const size = w * h;
            const pixelSize = pixels.length / size;
            const stride = imgData.width * pixelSize;
            const values = new Float32Array(size);
            let i = 0;
            for (let row = 0; row != imgData.height; row++) {
                const offset = stride * row;
                for (let column = 0; column != imgData.width; column++) {
                    i = this.pixelDecoder.decode(pixels, offset + column * pixelSize, values, i);
                }
            }
            return values;
        }
        return null;
    }
}
//# sourceMappingURL=tiles.codecs.image.js.map

/***/ }),

/***/ "./dist/tiles/tiles.codecs.js":
/*!************************************!*\
  !*** ./dist/tiles/tiles.codecs.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BlobTileCodec": () => (/* binding */ BlobTileCodec),
/* harmony export */   "JsonTileCodec": () => (/* binding */ JsonTileCodec),
/* harmony export */   "TextTileCodec": () => (/* binding */ TextTileCodec),
/* harmony export */   "XmlDocumentTileCodec": () => (/* binding */ XmlDocumentTileCodec)
/* harmony export */ });
class BlobTileCodec {
    async decodeAsync(r) {
        if (r instanceof Response) {
            const data = await r.blob();
            return data;
        }
        return null;
    }
}
BlobTileCodec.Shared = new BlobTileCodec();

class TextTileCodec {
    async decodeAsync(r) {
        if (r instanceof Response) {
            const data = await r.text();
            return data;
        }
        return null;
    }
}
TextTileCodec.Shared = new TextTileCodec();

class JsonTileCodec {
    async decodeAsync(r) {
        if (r instanceof Response) {
            const data = await r.json();
            return data;
        }
        return null;
    }
}
JsonTileCodec.Shared = new JsonTileCodec();

class XmlDocumentTileCodec {
    async decodeAsync(r) {
        const str = r instanceof Response ? await r.text() : null;
        if (str) {
            const data = new DOMParser().parseFromString(str, "application/xml");
            return data;
        }
        return null;
    }
}
XmlDocumentTileCodec.Shared = new XmlDocumentTileCodec();

//# sourceMappingURL=tiles.codecs.js.map

/***/ }),

/***/ "./dist/tiles/tiles.content.manager.js":
/*!*********************************************!*\
  !*** ./dist/tiles/tiles.content.manager.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ContentUpdateEventArgs": () => (/* binding */ ContentUpdateEventArgs),
/* harmony export */   "TileContentManager": () => (/* binding */ TileContentManager)
/* harmony export */ });
/* harmony import */ var _utils_cache__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/cache */ "./dist/utils/cache.js");
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _events_events_observable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../events/events.observable */ "./dist/events/events.observable.js");
/* harmony import */ var _events_events_args__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../events/events.args */ "./dist/events/events.args.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./tiles */ "./dist/tiles/tiles.js");






class ContentUpdateEventArgs extends _events_events_args__WEBPACK_IMPORTED_MODULE_0__.EventArgs {
    constructor(address, content, sender) {
        super(sender);
        this._address = address;
        this._content = content;
    }
    get address() {
        return this._address;
    }
    get content() {
        return this._content;
    }
}
class TileContentManager {
    constructor(datasource, cache) {
        this._cache = cache || new _utils_cache__WEBPACK_IMPORTED_MODULE_1__.MemoryCache();
        this._datasource = datasource;
        this._smoothingZomm = false;
    }
    get cache() {
        return this._cache;
    }
    get datasource() {
        return this._datasource;
    }
    get metrics() {
        return this._datasource.metrics;
    }
    get contentUpdateObservable() {
        this._contentUpdateObservable = this._contentUpdateObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_2__.Observable(this.onContentObserverAdded.bind(this));
        return this._contentUpdateObservable;
    }
    getTileContent(address) {
        const key = address.quadkey;
        if (this._cache.contains(key)) {
            return this._cache.get(key);
        }
        let c = this._smoothingZomm ? this.buildAlternativeTileContent(address) : null;
        this._cache.set(key, c);
        this._datasource
            .fetchAsync(address, this)
            .then((result) => {
            if (result.content) {
                const manager = result.userArgs[0];
                const address = result.address;
                const content = result.content;
                manager._cache.set(address.quadkey, content);
                if (this._contentUpdateObservable) {
                    const e = new ContentUpdateEventArgs(address, content, manager);
                    this._contentUpdateObservable.notifyObservers(e);
                }
            }
        })
            .catch((reason) => {
            console.log(`the lookup operation has failed because of ${reason}`);
        });
        return c;
    }
    buildTileContentView(address, source, target) {
        let key = _tiles__WEBPACK_IMPORTED_MODULE_3__.TileContentView.BuildKey(address, source, target);
        if (this._cache.contains(key)) {
            const view = this._cache.get(key);
            return view;
        }
        const view = new _tiles__WEBPACK_IMPORTED_MODULE_3__.TileContentView(address, source, target);
        this._cache.set(key, view);
        return view;
    }
    buildAlternativeTileContent(address) {
        let key = address.quadkey;
        const parentKey = _tiles_metrics__WEBPACK_IMPORTED_MODULE_4__.TileMetrics.ToParentKey(key);
        const content = this._cache.get(parentKey);
        if (content) {
            if ((0,_tiles_interfaces__WEBPACK_IMPORTED_MODULE_5__.IsTileContentView)(content)) {
                return null;
            }
            const source = _tiles_metrics__WEBPACK_IMPORTED_MODULE_4__.TileMetrics.ToNormalizedSection(key);
            if (source) {
                return this.buildTileContentView(address, source) ?? null;
            }
        }
        const childKeys = _tiles_metrics__WEBPACK_IMPORTED_MODULE_4__.TileMetrics.ToChildsKey(key);
        const targets = childKeys.map((k) => {
            return _tiles_metrics__WEBPACK_IMPORTED_MODULE_4__.TileMetrics.ToNormalizedSection(k);
        });
        return this.buildTileContentView(address, null, targets) ?? null;
    }
    onContentObserverAdded(observer) { }
}
//# sourceMappingURL=tiles.content.manager.js.map

/***/ }),

/***/ "./dist/tiles/tiles.geography.js":
/*!***************************************!*\
  !*** ./dist/tiles/tiles.geography.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EPSG3857": () => (/* binding */ EPSG3857)
/* harmony export */ });
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../geodesy/geodesy.ellipsoid */ "./dist/geodesy/geodesy.ellipsoid.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../math/math */ "./dist/math/math.js");
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../geography/geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry/geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");





class EPSG3857 extends _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__.AbstractTileMetrics {
    constructor(options, ellipsoid) {
        super(options);
        this._ellipsoid = ellipsoid || _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__.Ellipsoid.WGS84;
    }
    groundResolution(latitude, levelOfDetail) {
        latitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        return (Math.cos(latitude * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD) * 2 * Math.PI * this._ellipsoid.semiMajorAxis) / this.mapSize(levelOfDetail);
    }
    getLatLonToTileXY(latitude, longitude, levelOfDetail, tileXY) {
        const t = tileXY || _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.Zero();
        latitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);
        const n = Math.pow(2, levelOfDetail);
        const x = Math.floor(((longitude + 180) / 360) * n);
        const lat_rad = latitude * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD;
        const y = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);
        t.x = x;
        t.y = y;
        return t;
    }
    getTileXYToLatLon(x, y, levelOfDetail, loc) {
        const l = loc || _geography_geography_position__WEBPACK_IMPORTED_MODULE_4__.Geo2.Zero();
        let n = Math.pow(2, levelOfDetail);
        const lon = -180 + (x / n) * 360;
        n = Math.PI - (2 * Math.PI * y) / n;
        const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
        l.lat = lat;
        l.lon = lon;
        return l;
    }
    getLatLonToPixelXY(latitude, longitude, levelOfDetail, pixelXY) {
        const p = pixelXY || _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.Zero();
        latitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);
        const x = (longitude + 180) / 360;
        const sinLatitude = Math.sin(latitude * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD);
        const y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);
        const mapSize = this.mapSize(levelOfDetail);
        p.x = Math.round(_math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(x * mapSize + 0.5, 0, mapSize - 1));
        p.y = Math.round(_math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(y * mapSize + 0.5, 0, mapSize - 1));
        return p;
    }
    getPixelXYToLatLon(pixelX, pixelY, levelOfDetail, latLon) {
        const g = latLon || _geography_geography_position__WEBPACK_IMPORTED_MODULE_4__.Geo2.Zero();
        const mapSize = this.mapSize(levelOfDetail);
        const x = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(pixelX, 0, mapSize - 1) / mapSize - 0.5;
        const y = 0.5 - _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(pixelY, 0, mapSize - 1) / mapSize;
        g.lat = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
        g.lon = 360 * x;
        return g;
    }
    getTileXYToPixelXY(tileX, tileY, pixelXY) {
        const p = pixelXY || _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.Zero();
        const s = this.tileSize;
        p.x = tileX * s;
        p.y = tileY * s;
        return p;
    }
    getPixelXYToTileXY(pixelX, pixelY, tileXY) {
        const t = tileXY || _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.Zero();
        const s = this.tileSize;
        t.x = Math.floor(pixelX / s);
        t.y = Math.floor(pixelY / s);
        return t;
    }
}
EPSG3857.Shared = new EPSG3857();

//# sourceMappingURL=tiles.geography.js.map

/***/ }),

/***/ "./dist/tiles/tiles.interfaces.js":
/*!****************************************!*\
  !*** ./dist/tiles/tiles.interfaces.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CellCoordinateReference": () => (/* binding */ CellCoordinateReference),
/* harmony export */   "FetchResult": () => (/* binding */ FetchResult),
/* harmony export */   "IsTileContentView": () => (/* binding */ IsTileContentView),
/* harmony export */   "isTileAddress": () => (/* binding */ isTileAddress)
/* harmony export */ });
function isTileAddress(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.x !== undefined && b.y !== undefined && b.levelOfDetail !== undefined;
}
function IsTileContentView(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.source !== undefined && b.target !== undefined;
}
var CellCoordinateReference;
(function (CellCoordinateReference) {
    CellCoordinateReference["center"] = "center";
    CellCoordinateReference["nw"] = "nw";
    CellCoordinateReference["ne"] = "ne";
    CellCoordinateReference["sw"] = "sw";
    CellCoordinateReference["se"] = "se";
})(CellCoordinateReference || (CellCoordinateReference = {}));
class FetchResult {
    constructor(address, content, userArgs) {
        this.address = address;
        this.content = content;
        this.userArgs = userArgs;
    }
}
//# sourceMappingURL=tiles.interfaces.js.map

/***/ }),

/***/ "./dist/tiles/tiles.js":
/*!*****************************!*\
  !*** ./dist/tiles/tiles.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Tile": () => (/* binding */ Tile),
/* harmony export */   "TileBuilder": () => (/* binding */ TileBuilder),
/* harmony export */   "TileContentView": () => (/* binding */ TileContentView)
/* harmony export */ });
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../geometry/geometry.size */ "./dist/geometry/geometry.size.js");
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography/geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geography_geography_envelope__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geography/geography.envelope */ "./dist/geography/geography.envelope.js");
/* harmony import */ var _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../geometry/geometry.rectangle */ "./dist/geometry/geometry.rectangle.js");
/* harmony import */ var _tiles_address__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.address */ "./dist/tiles/tiles.address.js");





class TileBuilder {
    withAddress(a) {
        this._a = a;
        return this;
    }
    withData(d) {
        this._d = d;
        return this;
    }
    withMetrics(metrics) {
        this._m = metrics;
        return this;
    }
    build() {
        const t = new Tile(this._a?.x || 0, this._a?.y || 0, this._a?.levelOfDetail || this._m?.minLOD || 0, this._d || null);
        if (this._m) {
            t.bounds = Tile.BuildEnvelope(t.address, this._m);
            t.rect = Tile.BuildBounds(t.address, this._m);
        }
        return t;
    }
}
class TileContentView {
    static BuildKey(address, source, target) {
        return `${address.quadkey}_${source?.toString() ?? "x"}_${target?.toString() ?? "x"}`;
    }
    constructor(address, source, target) {
        this.address = address;
        this.source = source;
        this.target = target;
    }
    get key() {
        if (!this._key) {
            this._key = TileContentView.BuildKey(this.address, this.source, this.target);
        }
        return this._key;
    }
}
class Tile extends _tiles_address__WEBPACK_IMPORTED_MODULE_0__.TileAddress {
    static Builder() {
        return new TileBuilder();
    }
    static BuildEnvelope(a, metrics) {
        if (metrics) {
            const nw = metrics.getTileXYToLatLon(a.x, a.y, a.levelOfDetail);
            const se = metrics.getTileXYToLatLon(a.x + 1, a.y + 1, a.levelOfDetail);
            const size = new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_1__.Size3(nw.lat - se.lat, se.lon - nw.lon, 0);
            const pos = new _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__.Geo3(se.lat, nw.lon);
            return _geography_geography_envelope__WEBPACK_IMPORTED_MODULE_3__.Envelope.FromSize(pos, size);
        }
        return undefined;
    }
    static BuildBounds(a, metrics) {
        if (metrics) {
            const p = metrics.getTileXYToPixelXY(a.x, a.y);
            return new _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_4__.Rectangle(p.x, p.y, metrics.tileSize, metrics.tileSize);
        }
        return undefined;
    }
    constructor(x, y, levelOfDetail, data) {
        super(x, y, levelOfDetail);
        this._value = data;
    }
    get address() {
        return this;
    }
    get key() {
        return this.address.quadkey;
    }
    get content() {
        return this._value;
    }
    set content(v) {
        this._value = v;
    }
    get bounds() {
        return this._env;
    }
    set bounds(e) {
        this._env = e;
    }
    get rect() {
        return this._rect;
    }
    set rect(r) {
        this._rect = r;
    }
}
//# sourceMappingURL=tiles.js.map

/***/ }),

/***/ "./dist/tiles/tiles.mapview.js":
/*!*************************************!*\
  !*** ./dist/tiles/tiles.mapview.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LODTransitionMode": () => (/* binding */ LODTransitionMode),
/* harmony export */   "TileMapContext": () => (/* binding */ TileMapContext),
/* harmony export */   "TileMapView": () => (/* binding */ TileMapView),
/* harmony export */   "UpdateEventArgs": () => (/* binding */ UpdateEventArgs),
/* harmony export */   "UpdateInfos": () => (/* binding */ UpdateInfos),
/* harmony export */   "UpdateReason": () => (/* binding */ UpdateReason)
/* harmony export */ });
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography/geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _events_events_observable__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../events/events.observable */ "./dist/events/events.observable.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../math/math */ "./dist/math/math.js");
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../geometry/geometry.size */ "./dist/geometry/geometry.size.js");
/* harmony import */ var _events_events_args__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../events/events.args */ "./dist/events/events.args.js");
/* harmony import */ var _utils_cache__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/cache */ "./dist/utils/cache.js");
/* harmony import */ var _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../geometry/geometry.rectangle */ "./dist/geometry/geometry.rectangle.js");
/* harmony import */ var _tiles_address__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./tiles.address */ "./dist/tiles/tiles.address.js");
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./tiles */ "./dist/tiles/tiles.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geometry/geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geography_geography_envelope__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../geography/geography.envelope */ "./dist/geography/geography.envelope.js");












class TileMapContext {
    constructor() {
        this._lod = 0;
        this._scale = 1;
        this._center = _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
        this._tiles = new Map();
    }
    get lod() {
        return this._lod;
    }
    get scale() {
        return this._scale;
    }
    get tiles() {
        return this._tiles;
    }
    get size() {
        return this._tiles.size;
    }
    get center() {
        return this._center;
    }
}
var UpdateReason;
(function (UpdateReason) {
    UpdateReason[UpdateReason["viewChanged"] = 0] = "viewChanged";
    UpdateReason[UpdateReason["tileReady"] = 1] = "tileReady";
})(UpdateReason || (UpdateReason = {}));
class UpdateInfos {
    constructor(lod, scale, center) {
        this.lod = lod;
        this.scale = scale;
        this.center = center;
    }
}
class UpdateEventArgs extends _events_events_args__WEBPACK_IMPORTED_MODULE_1__.EventArgs {
    constructor(source, reason, infos, oldInfos, added, removed) {
        super(source);
        this._reason = reason;
        this._infos = infos;
        this._previousInfos = oldInfos;
        this._added = added;
        this._removed = removed;
    }
    get reason() {
        return this._reason;
    }
    get added() {
        return this._added;
    }
    get removed() {
        return this._removed;
    }
    get infos() {
        return this._infos;
    }
    get previousInfos() {
        return this._previousInfos;
    }
    get lod() {
        return this._infos.lod;
    }
    get scale() {
        return this._infos.scale;
    }
    get center() {
        return this._infos.center;
    }
}
var LODTransitionMode;
(function (LODTransitionMode) {
    LODTransitionMode[LODTransitionMode["OFF"] = 0] = "OFF";
    LODTransitionMode[LODTransitionMode["LINEAR"] = 1] = "LINEAR";
})(LODTransitionMode || (LODTransitionMode = {}));
class TileMapView {
    static ClampAzimuth(a) {
        return ((a % 360) + 360) % 360;
    }
    constructor(manager, width, height, center, lod, cache) {
        this._w = 0;
        this._h = 0;
        this._lod = 0;
        this._center = _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__.Geo2.Zero();
        this._valid = false;
        this._cartesianCache = _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
        this._lodTransition = LODTransitionMode.LINEAR;
        this._cache = cache || new _utils_cache__WEBPACK_IMPORTED_MODULE_3__.MemoryCache();
        this._manager = manager;
        this._manager.contentUpdateObservable.add(this.onTileContentUpdate.bind(this));
        this.invalidateSize(width, height).setView(center, lod);
        this._context = new TileMapContext();
        this._azimuth = 0;
        this._cosangle = 0;
        this._sinangle = 1;
    }
    get resizeObservable() {
        this._resizeObservable = this._resizeObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_4__.Observable(this.onResizeObserverAdded.bind(this));
        return this._resizeObservable;
    }
    get centerObservable() {
        this._centerObservable = this._centerObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_4__.Observable(this.onCenterObserverAdded.bind(this));
        return this._centerObservable;
    }
    get zoomObservable() {
        this._zoomObservable = this._zoomObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_4__.Observable(this.onZoomObserverAdded.bind(this));
        return this._zoomObservable;
    }
    get updateObservable() {
        this._updateObservable = this._updateObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_4__.Observable(this.onUpdateObserverAdded.bind(this));
        return this._updateObservable;
    }
    get bounds() {
        return this.validateBounds();
    }
    get datasource() {
        return this._manager.datasource;
    }
    get context() {
        return this._context;
    }
    get levelOfDetail() {
        return this._lod;
    }
    get center() {
        return this._center;
    }
    get azimuth() {
        return this._azimuth;
    }
    get metrics() {
        return this.datasource.metrics;
    }
    get width() {
        return this._w;
    }
    get height() {
        return this._h;
    }
    invalidateSize(w, h) {
        if (this._w !== w || this._h != h) {
            if (this._resizeObservable && this._resizeObservable.hasObservers()) {
                const old = new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_5__.Size2(this._w, this._h);
                const value = new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_5__.Size2(w, h);
                this._w = w;
                this._h = h;
                const e = new _events_events_args__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, value);
                this._resizeObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this._w = w;
            this._h = h;
            this.invalidate();
        }
        return this;
    }
    setView(center, zoom, azimuth) {
        if (center && !this.center.equals(center)) {
            if (this._centerObservable && this._centerObservable.hasObservers()) {
                const old = this._center.clone();
                this.center.lat = center.lat;
                this.center.lon = center.lon;
                const e = new _events_events_args__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, center);
                this._centerObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this.center.lat = center.lat;
            this.center.lon = center.lon;
            this.invalidate();
        }
        if (zoom) {
            this.setZoom(zoom);
        }
        if (azimuth) {
            this.setAzimuth(azimuth);
        }
        return this;
    }
    setZoom(zoom) {
        const lod = _math_math__WEBPACK_IMPORTED_MODULE_6__.Scalar.Clamp(zoom, this.metrics.minLOD, this.metrics.maxLOD);
        if (this._lod != lod) {
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                const old = this._lod;
                this._lod = lod;
                const e = new _events_events_args__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, zoom);
                this._zoomObservable.notifyObservers(e);
            }
            else {
                this._lod = lod;
            }
            this.invalidate();
        }
        return this;
    }
    setAzimuth(r) {
        this._azimuth = TileMapView.ClampAzimuth(r);
        const rad = this._azimuth * _math_math__WEBPACK_IMPORTED_MODULE_6__.Scalar.DEG2RAD;
        this._cosangle = Math.cos(rad);
        this._sinangle = Math.sin(rad);
        this.invalidate();
        return this;
    }
    zoomIn(delta) {
        return this.setZoom(this._lod + Math.abs(delta));
    }
    zoomOut(delta) {
        return this.setZoom(this._lod - Math.abs(delta));
    }
    translate(tx, ty) {
        if (this._azimuth) {
            const p = this.rotatePointInv(tx, ty, this._cartesianCache);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this._lod);
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        const center = this.metrics.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        return this.setView(center);
    }
    rotate(r) {
        return this.setAzimuth(this._azimuth + r);
    }
    validateBounds() {
        if (!this._bounds) {
            let rect = this.getRectangle(this._context._center, this._context._scale);
            let nw = this.metrics.getPixelXYToLatLon(rect.xmin, rect.ymin, this._context._lod);
            let se = this.metrics.getPixelXYToLatLon(rect.xmax, rect.ymax, this._context._lod);
            this._bounds = _geography_geography_envelope__WEBPACK_IMPORTED_MODULE_7__.Envelope.FromPoints(nw, se);
        }
        return this._bounds;
    }
    get isValid() {
        return this._valid;
    }
    invalidate() {
        this._valid = false;
        return this;
    }
    validate() {
        if (!this._valid) {
            this.doValidate();
            this._valid = true;
        }
        return this;
    }
    revalidate() {
        return this.invalidate().validate();
    }
    onResizeObserverAdded(observer) { }
    onZoomObserverAdded(observer) { }
    onCenterObserverAdded(observer) { }
    onUpdateObserverAdded(observer) { }
    doValidate() {
        this._context._lod = Math.round(this.levelOfDetail);
        this.doValidateContext(this._context);
    }
    doValidateContext(level) {
        const lod = level.lod;
        let scale = _tiles_metrics__WEBPACK_IMPORTED_MODULE_8__.TileMetrics.GetLodScale(this.levelOfDetail);
        this._context._scale = scale;
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        this._context._center = pixelCenterXY;
        const rect = this.getRectangle(pixelCenterXY, scale);
        let nwTileXY = this.metrics.getPixelXYToTileXY(rect.xmin, rect.ymin);
        let seTileXY = this.metrics.getPixelXYToTileXY(rect.xmax, rect.ymax);
        const maxIndex = this.metrics.mapSize(lod) / this.metrics.tileSize - 1;
        const x0 = Math.max(0, nwTileXY.x);
        const y0 = Math.max(0, nwTileXY.y);
        const x1 = Math.min(maxIndex, seTileXY.x);
        const y1 = Math.min(maxIndex, seTileXY.y);
        const remains = new Array();
        let added = new Array();
        const builder = new _tiles__WEBPACK_IMPORTED_MODULE_9__.TileBuilder().withMetrics(this.metrics);
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const a = new _tiles_address__WEBPACK_IMPORTED_MODULE_10__.TileAddress(x, y, lod);
                const key = a.quadkey;
                let t = level.tiles.get(key);
                if (t) {
                    remains.push(t);
                    level.tiles.delete(key);
                    continue;
                }
                t = this._cache.get(key);
                if (t) {
                    added.push(t);
                    continue;
                }
                t = builder.withAddress(a).build();
                this._cache.set(key, t);
                t.content = this._manager.getTileContent(a);
                added.push(t);
            }
        }
        let deleted = Array.from(level.tiles.values());
        level.tiles.clear();
        for (const t of remains) {
            level.tiles.set(t.address.quadkey, t);
        }
        for (const t of added) {
            level.tiles.set(t.address.quadkey, t);
        }
        added = added.filter((t) => t.content !== undefined);
        deleted = deleted.filter((t) => t.content !== undefined);
        const newInfos = new UpdateInfos(this._context.lod, this._context.scale, this._context.center);
        const updateEvent = new UpdateEventArgs(this, UpdateReason.viewChanged, newInfos, this._oldInfos, added.length ? added : undefined, deleted.length ? deleted : undefined);
        this._oldInfos = newInfos;
        this.updateObservable.notifyObservers(updateEvent);
    }
    onTileContentUpdate(args) {
        let t;
        t = this._cache.get(args.address.quadkey);
        if (t) {
            if (args.content) {
                t.content = args.content;
                this.onTileReady(t);
                return;
            }
            this.onTileNotFound(t);
        }
    }
    onTileReady(t) {
        if (t.address.levelOfDetail == this._context.lod) {
            this._context.tiles.set(t.address.quadkey, t);
            const added = [t];
            const newInfos = new UpdateInfos(this._context.lod, this._context.scale, this._context.center);
            const updateEvent = new UpdateEventArgs(this, UpdateReason.tileReady, newInfos, this._oldInfos, added);
            this._oldInfos = newInfos;
            this.updateObservable.notifyObservers(updateEvent);
        }
    }
    onTileNotFound(t) {
        console.log("tile not found", t.address);
        t.content = null;
    }
    *rotatePointsArround(center, ...points) {
        for (const p of points) {
            yield this.rotatePointArround(p.x, p.y, center);
        }
    }
    rotatePointInv(x, y, target) {
        const r = target || _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
        r.x = x * this._cosangle + y * this._sinangle;
        r.y = -x * this._sinangle + y * this._cosangle;
        return r;
    }
    rotatePointArround(x, y, center, target) {
        const r = target || _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
        const translatedX = x - center.x;
        const translatedY = y - center.y;
        r.x = translatedX * this._cosangle - translatedY * this._sinangle + center.x;
        r.y = translatedX * this._sinangle + translatedY * this._cosangle + center.y;
        return r;
    }
    getRectangle(center, scale) {
        const w = this.width / scale;
        const h = this.height / scale;
        const x0 = center.x - w / 2;
        const y0 = center.y - h / 2;
        let bounds = new _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_11__.Rectangle(x0, y0, w, h);
        if (this._azimuth) {
            const corners = bounds.points();
            const rotated = Array.from(this.rotatePointsArround(center, ...corners));
            bounds = _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_11__.Rectangle.FromPoints(...rotated);
            return bounds;
        }
        return bounds;
    }
}
//# sourceMappingURL=tiles.mapview.js.map

/***/ }),

/***/ "./dist/tiles/tiles.metrics.js":
/*!*************************************!*\
  !*** ./dist/tiles/tiles.metrics.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractTileMetrics": () => (/* binding */ AbstractTileMetrics),
/* harmony export */   "TileMetrics": () => (/* binding */ TileMetrics),
/* harmony export */   "TileMetricsOptions": () => (/* binding */ TileMetricsOptions),
/* harmony export */   "TileMetricsOptionsBuilder": () => (/* binding */ TileMetricsOptionsBuilder)
/* harmony export */ });
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _tiles_address__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.address */ "./dist/tiles/tiles.address.js");


class TileMetricsOptions {
    constructor(p) {
        Object.assign(this, p);
    }
}
TileMetricsOptions.DefaultTileSize = 256;
TileMetricsOptions.DefaultLOD = 0;
TileMetricsOptions.DefaultMinLOD = 0;
TileMetricsOptions.DefaultMaxLOD = 23;
TileMetricsOptions.DefaultMinLatitude = -85.05112878;
TileMetricsOptions.DefaultMaxLatitude = 85.05112878;
TileMetricsOptions.DefaultMinLongitude = -180;
TileMetricsOptions.DefaultMaxLongitude = 180;
TileMetricsOptions.DefaultCellSize = 1;
TileMetricsOptions.DefaultCoordinateReference = _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.CellCoordinateReference.center;
TileMetricsOptions.DefaultOverlap = 0;
TileMetricsOptions.Shared = {
    tileSize: TileMetricsOptions.DefaultTileSize,
    minLOD: TileMetricsOptions.DefaultMinLOD,
    maxLOD: TileMetricsOptions.DefaultMaxLOD,
    minLatitude: TileMetricsOptions.DefaultMinLatitude,
    maxLatitude: TileMetricsOptions.DefaultMaxLatitude,
    minLongitude: TileMetricsOptions.DefaultMinLongitude,
    maxLongitude: TileMetricsOptions.DefaultMaxLongitude,
    cellSize: TileMetricsOptions.DefaultCellSize,
    cellCoordinateReference: TileMetricsOptions.DefaultCoordinateReference,
    overlap: TileMetricsOptions.DefaultOverlap,
};

class TileMetricsOptionsBuilder {
    withTileSize(v) {
        this._tileSize = v;
        return this;
    }
    withCellSize(v) {
        this._cellSize = v;
        return this;
    }
    withCellCoordinateReference(v) {
        this._cellCoordinateReference = v;
        return this;
    }
    withTOverlap(v) {
        this._overlap = v;
        return this;
    }
    withMinLOD(v) {
        this._minLOD = v;
        return this;
    }
    withMaxLOD(v) {
        this._maxLOD = v;
        return this;
    }
    withMinLatitude(v) {
        this._minLatitude = v;
        return this;
    }
    withMaxLatitude(v) {
        this._maxLatitude = v;
        return this;
    }
    withMinLongitude(v) {
        this._minLongitude = v;
        return this;
    }
    withMaxLongitude(v) {
        this._maxLongitude = v;
        return this;
    }
    build() {
        return new TileMetricsOptions({
            tileSize: this._tileSize,
            minLOD: this._minLOD,
            maxLOD: this._maxLOD,
            minLatitude: this._minLatitude,
            maxLatitude: this._maxLatitude,
            minLongitude: this._minLongitude,
            maxLongitude: this._maxLongitude,
            cellSize: this._cellSize,
            cellCoordinateReference: this._cellCoordinateReference,
            overlap: this._overlap,
        });
    }
}
class TileMetrics {
    static GetLodScale(lod) {
        let lodOffset = (lod * 1000 - Math.round(lod) * 1000) / 1000;
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        return scale;
    }
    static ToParentKey(key) {
        return key && key.length > 1 ? key.substring(0, key.length - 1) : key;
    }
    static ToNormalizedSection(key) {
        if (key === null || key === undefined || key.length <= 1) {
            return null;
        }
        const c = key.charAt(key.length - 1);
        let s = { x: 0, y: 0, z: 0.5 };
        switch (c) {
            case "1": {
                s.x = s.z;
                break;
            }
            case "2": {
                s.y = s.z;
                break;
            }
            case "3": {
                s.x = s.y = s.z;
                break;
            }
        }
        return s;
    }
    static ToChildsKey(key) {
        key = key || "";
        return [key.slice() + "0", key.slice() + "1", key.slice() + "2", key.slice() + "3"];
    }
    static ToNeigborsKey(key) {
        return TileMetrics.ToNeigborsXY(TileMetrics.QuadKeyToTileXY(key)).map((a) => (a ? TileMetrics.TileXYToQuadKey(a) : null));
    }
    static ToNeigborsXY(a) {
        const max = Math.pow(2, a.levelOfDetail);
        const n = [
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x - 1, a.y - 1, a.levelOfDetail),
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x, a.y - 1, a.levelOfDetail),
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x + 1, a.y - 1, a.levelOfDetail),
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x - 1, a.y, a.levelOfDetail),
            a,
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x + 1, a.y, a.levelOfDetail),
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x - 1, a.y + 1, a.levelOfDetail),
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x, a.y + 1, a.levelOfDetail),
            new _tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress(a.x + 1, a.y + 1, a.levelOfDetail),
        ];
        return n.map((ad) => (ad.x >= 0 && ad.y >= 0 && ad.x < max && ad.y < max ? ad : null));
    }
    static TileXYToQuadKey(a) {
        let quadKey = "";
        for (let i = a.levelOfDetail; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((a.x & mask) != 0) {
                digit++;
            }
            if ((a.y & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey = quadKey + digit;
        }
        return quadKey;
    }
    static QuadKeyToTileXY(quadKey) {
        let tileX = 0;
        let tileY = 0;
        const levelOfDetail = quadKey.length;
        for (let i = levelOfDetail; i > 0; i--) {
            const mask = 1 << (i - 1);
            switch (quadKey[levelOfDetail - i]) {
                case "0":
                    break;
                case "1":
                    tileX |= mask;
                    break;
                case "2":
                    tileY |= mask;
                    break;
                case "3":
                    tileX |= mask;
                    tileY |= mask;
                    break;
                default:
                    throw new Error("Invalid QuadKey digit sequence.");
            }
        }
        return { x: tileX, y: tileY, levelOfDetail: levelOfDetail };
    }
}
class AbstractTileMetrics {
    constructor(options) {
        this._o = { ...TileMetricsOptions.Shared, ...options };
    }
    get options() {
        return this._o;
    }
    mapSize(levelOfDetail) {
        return this.tileSize << levelOfDetail;
    }
    get minLOD() {
        return this._o.minLOD || TileMetricsOptions.DefaultMinLOD;
    }
    get maxLOD() {
        return this._o.maxLOD || TileMetricsOptions.DefaultMaxLOD;
    }
    get minLatitude() {
        return this._o.minLatitude || TileMetricsOptions.DefaultMinLatitude;
    }
    get maxLatitude() {
        return this._o.maxLatitude || TileMetricsOptions.DefaultMaxLatitude;
    }
    get minLongitude() {
        return this._o.minLongitude || TileMetricsOptions.DefaultMinLongitude;
    }
    get maxLongitude() {
        return this._o.maxLongitude || TileMetricsOptions.DefaultMaxLongitude;
    }
    get tileSize() {
        return this._o.tileSize || TileMetricsOptions.DefaultTileSize;
    }
    get cellSize() {
        return this._o.cellSize || TileMetricsOptions.DefaultCellSize;
    }
    get cellCoordinateReference() {
        return this._o.cellCoordinateReference || TileMetricsOptions.DefaultCoordinateReference;
    }
    get overlap() {
        return this._o.overlap || TileMetricsOptions.DefaultOverlap;
    }
    isValidAddress(a) {
        if (a.levelOfDetail < 0 || a.levelOfDetail > this.maxLOD) {
            return false;
        }
        const s = (0x01 << a.levelOfDetail) - 1;
        if (a.x < 0 || a.x > s) {
            return false;
        }
        if (a.y < 0 || a.y > s) {
            return false;
        }
        return true;
    }
    assertValidAddress(a) {
        if (a.levelOfDetail < 0 || a.levelOfDetail > this.maxLOD) {
            throw new Error(`Invalid levelOfDetail ${a.levelOfDetail}`);
        }
        const s = (0x01 << a.levelOfDetail) - 1;
        if (a.x < 0 || a.x > s) {
            throw new Error(`Invalid x ${a.x}, must be in [0,${s}] range.`);
        }
        if (a.y < 0 || a.y > s) {
            throw new Error(`Invalid y ${a.y}, must be in [0,${s}] range.`);
        }
    }
    mapScale(latitude, levelOfDetail, pixelPerUnit) {
        return 1 / (this.groundResolution(latitude, levelOfDetail) * pixelPerUnit);
    }
}
//# sourceMappingURL=tiles.metrics.js.map

/***/ }),

/***/ "./dist/tiles/tiles.urlBuilder.js":
/*!****************************************!*\
  !*** ./dist/tiles/tiles.urlBuilder.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WebTileUrlBuilder": () => (/* binding */ WebTileUrlBuilder)
/* harmony export */ });
class WebTileUrlBuilder {
    constructor() { }
    withSecure(v) {
        this._isSecure = v;
        return this;
    }
    withHost(v) {
        this._host = v;
        return this;
    }
    withPort(v) {
        this._port = v;
        return this;
    }
    withPath(v) {
        this._path = v;
        return this;
    }
    withQuery(v) {
        this._query = v;
        return this;
    }
    withExtension(v) {
        this._extension = v;
        return this;
    }
    withSubDomains(subdomains) {
        this._subdomains = subdomains;
        return this;
    }
    buildUrl(a, ...params) {
        const scheme = this._isSecure ? "https" : "http";
        const host = this._port ? `${this._host}:${this._port}` : `${this._host}`;
        const query = this._query ? `?${this._query}` : "";
        let template = `${scheme}://${host}/${this._path}${query}`;
        if (this._extension) {
            template = template.replaceAll("{extension}", this._extension);
        }
        let str = template.replaceAll("{x}", a.x.toString());
        str = str.replaceAll("{y}", a.y.toString());
        str = str.replaceAll("{z}", a.levelOfDetail.toString());
        if (this._subdomains) {
            let i = this._i ?? 0;
            if (i >= this._subdomains.length) {
                i = 0;
            }
            const s = this._subdomains[i];
            str = str.replace("{s}", s);
            this._i = i + 1;
        }
        return str;
    }
}
//# sourceMappingURL=tiles.urlBuilder.js.map

/***/ }),

/***/ "./dist/tiles/vendors/index.js":
/*!*************************************!*\
  !*** ./dist/tiles/vendors/index.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Google": () => (/* reexport safe */ _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_2__.Google),
/* harmony export */   "GoogleMap2DLayerCode": () => (/* reexport safe */ _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_2__.GoogleMap2DLayerCode),
/* harmony export */   "GoogleMap2DUrlBuilder": () => (/* reexport safe */ _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_2__.GoogleMap2DUrlBuilder),
/* harmony export */   "MapBox": () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_1__.MapBox),
/* harmony export */   "MapBoxTerrainDemV1UrlBuilder": () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_1__.MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   "MapZen": () => (/* reexport safe */ _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__.MapZen),
/* harmony export */   "MapZenDemUrlBuilder": () => (/* reexport safe */ _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__.MapZenDemUrlBuilder),
/* harmony export */   "MapboxAltitudeDecoder": () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_1__.MapboxAltitudeDecoder),
/* harmony export */   "MapzenAltitudeDecoder": () => (/* reexport safe */ _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__.MapzenAltitudeDecoder)
/* harmony export */ });
/* harmony import */ var _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.vendors.mapzen */ "./dist/tiles/vendors/tiles.vendors.mapzen.js");
/* harmony import */ var _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.vendors.mapbox */ "./dist/tiles/vendors/tiles.vendors.mapbox.js");
/* harmony import */ var _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.vendors.google */ "./dist/tiles/vendors/tiles.vendors.google.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/vendors/tiles.vendors.google.js":
/*!****************************************************!*\
  !*** ./dist/tiles/vendors/tiles.vendors.google.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Google": () => (/* binding */ Google),
/* harmony export */   "GoogleMap2DLayerCode": () => (/* binding */ GoogleMap2DLayerCode),
/* harmony export */   "GoogleMap2DUrlBuilder": () => (/* binding */ GoogleMap2DUrlBuilder)
/* harmony export */ });
/* harmony import */ var _tiles_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles.client */ "./dist/tiles/tiles.client.js");
/* harmony import */ var _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../tiles.codecs.image */ "./dist/tiles/tiles.codecs.image.js");
/* harmony import */ var _tiles_geography__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../tiles.geography */ "./dist/tiles/tiles.geography.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.urlBuilder */ "./dist/tiles/tiles.urlBuilder.js");





var GoogleMap2DLayerCode;
(function (GoogleMap2DLayerCode) {
    GoogleMap2DLayerCode["street"] = "m";
    GoogleMap2DLayerCode["satellite"] = "s";
    GoogleMap2DLayerCode["hybrid"] = "h";
    GoogleMap2DLayerCode["terrain"] = "p";
})(GoogleMap2DLayerCode || (GoogleMap2DLayerCode = {}));
class GoogleMap2DUrlBuilder extends _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
    constructor(...types) {
        super();
        this.withSubDomains(["mt0", "mt1", "mt2", "mt3"])
            .withHost("{s}.google.com")
            .withPath(`vt/lyrs=${types.join(",")}&x={x}&y={y}&z={z}`);
    }
}
GoogleMap2DUrlBuilder.Street = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.street);
GoogleMap2DUrlBuilder.Satellite = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite);
GoogleMap2DUrlBuilder.Hybrid = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite, GoogleMap2DLayerCode.hybrid);
GoogleMap2DUrlBuilder.Terrain = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.terrain);

class Google {
    static Client2d(urlBuilder, options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(urlBuilder, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static StreetClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(GoogleMap2DUrlBuilder.Street, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static SatelliteClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(GoogleMap2DUrlBuilder.Satellite, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static HybridClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(GoogleMap2DUrlBuilder.Hybrid, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static TerrainClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(GoogleMap2DUrlBuilder.Terrain, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
}
Google.MaxLevelOfDetail = 20;
Google.MetricsOptions = new _tiles_metrics__WEBPACK_IMPORTED_MODULE_3__.TileMetricsOptionsBuilder().withMaxLOD(Google.MaxLevelOfDetail).build();
Google.Metrics = new _tiles_geography__WEBPACK_IMPORTED_MODULE_4__.EPSG3857(Google.MetricsOptions);

//# sourceMappingURL=tiles.vendors.google.js.map

/***/ }),

/***/ "./dist/tiles/vendors/tiles.vendors.mapbox.js":
/*!****************************************************!*\
  !*** ./dist/tiles/vendors/tiles.vendors.mapbox.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MapBox": () => (/* binding */ MapBox),
/* harmony export */   "MapBoxTerrainDemV1UrlBuilder": () => (/* binding */ MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   "MapboxAltitudeDecoder": () => (/* binding */ MapboxAltitudeDecoder)
/* harmony export */ });
/* harmony import */ var _geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../geometry/geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");
/* harmony import */ var _dem_dem_tileclient__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../dem/dem.tileclient */ "./dist/dem/dem.tileclient.js");
/* harmony import */ var _tiles_client__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../tiles.client */ "./dist/tiles/tiles.client.js");
/* harmony import */ var _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../tiles.codecs.image */ "./dist/tiles/tiles.codecs.image.js");
/* harmony import */ var _tiles_geography__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../tiles.geography */ "./dist/tiles/tiles.geography.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.urlBuilder */ "./dist/tiles/tiles.urlBuilder.js");







class MapBoxTerrainDemV1UrlBuilder extends _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
    constructor(token, extension = "webp") {
        super();
        this.withHost("api.mapbox.com")
            .withSecure(true)
            .withQuery(`access_token=${token}`)
            .withPath(`raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.{extension}`)
            .withExtension(extension);
    }
}
class MapboxAltitudeDecoder {
    decode(pixels, offset, target, targetOffset) {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];
        target[targetOffset++] = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
        return targetOffset;
    }
}
MapboxAltitudeDecoder.Shared = new MapboxAltitudeDecoder();

class MapBox {
    static TerrainDemV1Client(token, options) {
        let mo = new _tiles_metrics__WEBPACK_IMPORTED_MODULE_1__.TileMetricsOptionsBuilder().withTileSize(512).withMaxLOD(MapBox.MaxLevelOfDetail);
        const metrics = new _tiles_geography__WEBPACK_IMPORTED_MODULE_2__.EPSG3857(mo.build());
        const codecOptions = new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__.Float32TileCodecOptionsBuilder().withInsets(1, _geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_4__.Side.top).withInsets(1, _geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_4__.Side.left).withInsets(1, _geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_4__.Side.bottom).withInsets(1, _geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_4__.Side.right).build();
        const elevationClient = new _tiles_client__WEBPACK_IMPORTED_MODULE_5__.TileWebClient(new MapBoxTerrainDemV1UrlBuilder(token), new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__.Float32TileCodec(MapboxAltitudeDecoder.Shared, codecOptions), metrics, options);
        return new _dem_dem_tileclient__WEBPACK_IMPORTED_MODULE_6__.DemTileWebClient(elevationClient);
    }
}
MapBox.MaxLevelOfDetail = 14;

//# sourceMappingURL=tiles.vendors.mapbox.js.map

/***/ }),

/***/ "./dist/tiles/vendors/tiles.vendors.mapzen.js":
/*!****************************************************!*\
  !*** ./dist/tiles/vendors/tiles.vendors.mapzen.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MapZen": () => (/* binding */ MapZen),
/* harmony export */   "MapZenDemUrlBuilder": () => (/* binding */ MapZenDemUrlBuilder),
/* harmony export */   "MapzenAltitudeDecoder": () => (/* binding */ MapzenAltitudeDecoder)
/* harmony export */ });
/* harmony import */ var _tiles_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles.client */ "./dist/tiles/tiles.client.js");
/* harmony import */ var _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.urlBuilder */ "./dist/tiles/tiles.urlBuilder.js");
/* harmony import */ var _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../tiles.codecs.image */ "./dist/tiles/tiles.codecs.image.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _tiles_geography__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../tiles.geography */ "./dist/tiles/tiles.geography.js");
/* harmony import */ var _dem_dem_tileclient__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../dem/dem.tileclient */ "./dist/dem/dem.tileclient.js");






class MapZenDemUrlBuilder extends _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
    constructor(format, extension = "png") {
        super();
        this.withHost("s3.amazonaws.com").withPath(`elevation-tiles-prod/${format}/{z}/{x}/{y}.{extension}`).withSecure(true).withExtension(extension);
    }
}
MapZenDemUrlBuilder.Terrarium = new MapZenDemUrlBuilder("terrarium");
MapZenDemUrlBuilder.Normal = new MapZenDemUrlBuilder("normal");

class MapzenAltitudeDecoder {
    decode(pixels, offset, target, targetOffset) {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];
        target[targetOffset++] = r * 256 + g + b / 256 - 32768;
        return targetOffset;
    }
}
MapzenAltitudeDecoder.Shared = new MapzenAltitudeDecoder();

class MapZen {
    static ElevationsImagesClient(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(MapZenDemUrlBuilder.Terrarium, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), MapZen.Metrics, options);
    }
    static ElevationsClient(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(MapZenDemUrlBuilder.Terrarium, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.Float32TileCodec(MapzenAltitudeDecoder.Shared), MapZen.Metrics, options);
    }
    static NormalsImagesClient(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(MapZenDemUrlBuilder.Normal, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), MapZen.Metrics, options);
    }
    static NormalsClient(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(MapZenDemUrlBuilder.Normal, new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.RGBATileCodec(), MapZen.Metrics, options);
    }
    static DemClient(optionsElevations, optionsNormals) {
        return new _dem_dem_tileclient__WEBPACK_IMPORTED_MODULE_3__.DemTileWebClient(MapZen.ElevationsClient(optionsElevations), MapZen.NormalsImagesClient(optionsNormals));
    }
}
MapZen.MaxLevelOfDetail = 15;
MapZen.MetricsOptions = new _tiles_metrics__WEBPACK_IMPORTED_MODULE_4__.TileMetricsOptionsBuilder().withMaxLOD(MapZen.MaxLevelOfDetail).build();
MapZen.Metrics = new _tiles_geography__WEBPACK_IMPORTED_MODULE_5__.EPSG3857(MapZen.MetricsOptions);

//# sourceMappingURL=tiles.vendors.mapzen.js.map

/***/ }),

/***/ "./dist/utils/cache.js":
/*!*****************************!*\
  !*** ./dist/utils/cache.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CacheEntry": () => (/* binding */ CacheEntry),
/* harmony export */   "CacheEntryOptions": () => (/* binding */ CacheEntryOptions),
/* harmony export */   "CacheEntryOptionsBuilder": () => (/* binding */ CacheEntryOptionsBuilder),
/* harmony export */   "CachePolicy": () => (/* binding */ CachePolicy),
/* harmony export */   "CachePolicyBuilder": () => (/* binding */ CachePolicyBuilder),
/* harmony export */   "EvictionReason": () => (/* binding */ EvictionReason),
/* harmony export */   "MemoryCache": () => (/* binding */ MemoryCache)
/* harmony export */ });
var EvictionReason;
(function (EvictionReason) {
    EvictionReason[EvictionReason["user"] = 0] = "user";
    EvictionReason[EvictionReason["expired"] = 1] = "expired";
})(EvictionReason || (EvictionReason = {}));
class CachePolicyBuilder {
    withSlidingExpiration(slidingExpiration) {
        this._slidingExpiration = slidingExpiration;
        return this;
    }
    withSlidingExpirationFromMinutes(slidingExpiration) {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 60000 : slidingExpiration;
        return this;
    }
    withSlidingExpirationFromSeconds(slidingExpiration) {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 1000 : slidingExpiration;
        return this;
    }
    withThreshold(threshold) {
        this._threshold = threshold;
        return this;
    }
    build() {
        return new CachePolicy({ slidingExpiration: this._slidingExpiration, threshold: this._threshold });
    }
}
class CachePolicy {
    constructor(init) {
        Object.assign(this, init);
    }
}
CachePolicy.Default = new CachePolicyBuilder().withSlidingExpirationFromMinutes(5).withThreshold(100).build();

class CacheEntryOptions {
    constructor(init) {
        Object.assign(this, init);
    }
    get slidingExpiration() {
        return this._slidingExpiration;
    }
    set slidingExpiration(v) {
        this._slidingExpiration = v;
    }
    get postEvictionCallback() {
        return (this._callbacks = this._callbacks || []);
    }
    set postEvictionCallback(a) {
        this._callbacks = a;
    }
}
class CacheEntryOptionsBuilder {
    withSlidingExpiration(slidingExpiration) {
        this._slidingExpiration = slidingExpiration;
        return this;
    }
    withSlidingExpirationFromMinutes(slidingExpiration) {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 60000 : slidingExpiration;
        return this;
    }
    withSlidingExpirationFromSeconds(slidingExpiration) {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 1000 : slidingExpiration;
        return this;
    }
    withPostEvictionCallbacks(..._callbacks) {
        this._callbacks = this._callbacks || [];
        this._callbacks.push(..._callbacks);
        return this;
    }
    build() {
        return new CacheEntryOptions({ slidingExpiration: this._slidingExpiration, postEvictionCallback: this._callbacks });
    }
}
class CacheEntry {
    constructor(key, value, options) {
        this._options = options;
        this._value = value;
        this._lastAccess = Date.now();
    }
    get key() {
        return this._key;
    }
    get value() {
        this._lastAccess = Date.now();
        return this._value;
    }
    set value(v) {
        this._lastAccess = Date.now();
        this._value = v;
    }
    get expiration() {
        const se = this._options?._slidingExpiration;
        if (!this._lastAccess || !se) {
            return Infinity;
        }
        return this._lastAccess + se;
    }
    *postEvictionCallback() {
        return this._options?._callbacks;
    }
}
class MemoryCache {
    constructor(policy) {
        this._count = 0;
        this._policy = { ...CachePolicy.Default, ...policy };
        this._cache = new Map();
        this._gc = this.gc.bind(this);
    }
    contains(key) {
        return this._cache.has(key);
    }
    get(key) {
        const e = this._cache.get(key);
        if (e) {
            const v = e.value;
            this.sortList(e);
            return v;
        }
        return undefined;
    }
    set(key, value, options) {
        const o = { ...{ slidingExpiration: this._policy.slidingExpiration }, ...options };
        let e = this._cache.get(key);
        if (!e) {
            e = new CacheEntry(key, value, o);
            this._cache.set(key, e);
        }
        else {
            e.value = value;
        }
        this.sortList(e);
        return;
    }
    delete(key) {
        const e = this._cache.get(key);
        if (e) {
            const isHead = e === this._head;
            this.removeNode(e);
            this._cache.delete(key);
            for (const cb of e.postEvictionCallback()) {
                cb(e, EvictionReason.user);
            }
            if (isHead) {
                this.updateTimer();
            }
        }
    }
    keys() {
        return this._cache.keys();
    }
    gc() {
        const now = Date.now();
        const threshold = this._policy.threshold || 0;
        if (this._head && this._head.expiration <= now) {
            do {
                const tmp = this._head;
                this.removeNode(tmp);
                this._cache.delete(tmp.key);
                for (const cb of tmp.postEvictionCallback()) {
                    cb(tmp, EvictionReason.expired);
                }
            } while (this._head && this._head.expiration - threshold <= now);
        }
        this.updateTimer();
    }
    updateTimer() {
        if (this._head) {
            const delay = this._head.expiration - Date.now();
            if (this._timer) {
                clearTimeout(this._timer);
            }
            this._timer = setTimeout(this._gc, delay);
        }
        else {
            this._timer = undefined;
        }
    }
    sortList(e) {
        if (e) {
            const head = this._head;
            try {
                if (!e._next && !e._prev) {
                    this.insertLast(e);
                }
                const value = e.expiration;
                let n = e._prev;
                if (n && n.expiration > value) {
                    this.removeNode(e);
                    do {
                        n = n._prev;
                    } while (n && n.expiration > value);
                    if (n) {
                        this.insertAfter(e, n);
                        return;
                    }
                    this.insertFirst(e);
                    return;
                }
                n = e._next;
                if (n && n.expiration < value) {
                    this.removeNode(e);
                    do {
                        n = n._next;
                    } while (n && n.expiration < value);
                    if (n) {
                        this.insertBefore(e, n);
                    }
                    else {
                        this.insertLast(e);
                    }
                }
            }
            finally {
                if (this._head && this._head !== head) {
                    const delay = this._head.expiration - Date.now();
                    if (this._timer) {
                        clearTimeout(this._timer);
                    }
                    this._timer = setTimeout(this._gc, delay);
                }
            }
        }
    }
    removeNode(e) {
        if (e._next) {
            e._next._prev = e._prev;
        }
        if (e._prev) {
            e._prev._next = e._next;
        }
        if (this._head === e) {
            this._head = e._next;
        }
        if (this._tail === e) {
            this._tail = e._prev;
        }
        e._next = e._prev = undefined;
        this._count--;
    }
    insertFirst(node) {
        if (!this._tail) {
            this._tail = node;
        }
        if (this._head) {
            this._head._prev = node;
            node._next = this._head;
        }
        this._head = node;
        this._count++;
    }
    insertLast(node) {
        if (!this._head) {
            this._head = node;
        }
        if (this._tail) {
            this._tail._next = node;
            node._prev = this._tail;
        }
        this._tail = node;
        this._count++;
    }
    insertAfter(node, referenceNode) {
        if (!referenceNode._next) {
            this._tail = node;
        }
        if (referenceNode._next) {
            referenceNode._next._prev = node;
            node._next = referenceNode._next;
        }
        referenceNode._next = node;
        node._prev = referenceNode;
        this._count++;
    }
    insertBefore(node, referenceNode) {
        if (!referenceNode._prev) {
            this._head = node;
        }
        if (referenceNode._prev) {
            referenceNode._prev._next = node;
            node._prev = referenceNode._prev;
        }
        referenceNode._prev = node;
        node._next = referenceNode;
        this._count++;
    }
}
//# sourceMappingURL=cache.js.map

/***/ }),

/***/ "./dist/utils/index.js":
/*!*****************************!*\
  !*** ./dist/utils/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CacheEntry": () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_1__.CacheEntry),
/* harmony export */   "CacheEntryOptions": () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_1__.CacheEntryOptions),
/* harmony export */   "CacheEntryOptionsBuilder": () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_1__.CacheEntryOptionsBuilder),
/* harmony export */   "CachePolicy": () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_1__.CachePolicy),
/* harmony export */   "CachePolicyBuilder": () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_1__.CachePolicyBuilder),
/* harmony export */   "EvictionReason": () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_1__.EvictionReason),
/* harmony export */   "MemoryCache": () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_1__.MemoryCache),
/* harmony export */   "ObjectPool": () => (/* reexport safe */ _objectpools__WEBPACK_IMPORTED_MODULE_0__.ObjectPool),
/* harmony export */   "ObjectPoolOptions": () => (/* reexport safe */ _objectpools__WEBPACK_IMPORTED_MODULE_0__.ObjectPoolOptions)
/* harmony export */ });
/* harmony import */ var _objectpools__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./objectpools */ "./dist/utils/objectpools.js");
/* harmony import */ var _cache__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./cache */ "./dist/utils/cache.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/utils/objectpools.js":
/*!***********************************!*\
  !*** ./dist/utils/objectpools.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ObjectPool": () => (/* binding */ ObjectPool),
/* harmony export */   "ObjectPoolOptions": () => (/* binding */ ObjectPoolOptions)
/* harmony export */ });
class ObjectPoolOptions {
    constructor(factory, maxCount, clean) {
        this.factory = factory;
        this.maxCount = maxCount;
        this.clean = clean;
    }
}
class ObjectPool {
    constructor(options) {
        this.pool = [];
        this._o = options;
    }
    alloc() {
        let obj = this.pool.pop();
        if (obj) {
            return obj;
        }
        return this._o.factory();
    }
    free(obj) {
        if (this._o.clean) {
            this._o.clean(obj);
        }
        if (!this._o.maxCount || this.pool.length < this._o.maxCount) {
            this.pool.push(obj);
        }
    }
}
//# sourceMappingURL=objectpools.js.map

/***/ })

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
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!***********************!*\
  !*** ./dist/index.js ***!
  \***********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractDisplayMap": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.AbstractDisplayMap),
/* harmony export */   "AbstractRange": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.AbstractRange),
/* harmony export */   "AbstractTileMetrics": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.AbstractTileMetrics),
/* harmony export */   "Angle": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Angle),
/* harmony export */   "AxialTilt": () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_7__.AxialTilt),
/* harmony export */   "BlobTileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.BlobTileCodec),
/* harmony export */   "Box": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.Box),
/* harmony export */   "CacheEntry": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.CacheEntry),
/* harmony export */   "CacheEntryOptions": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.CacheEntryOptions),
/* harmony export */   "CacheEntryOptionsBuilder": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.CacheEntryOptionsBuilder),
/* harmony export */   "CachePolicy": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.CachePolicy),
/* harmony export */   "CachePolicyBuilder": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.CachePolicyBuilder),
/* harmony export */   "CanvasController": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.CanvasController),
/* harmony export */   "CanvasDisplay": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.CanvasDisplay),
/* harmony export */   "CanvasTileMap": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.CanvasTileMap),
/* harmony export */   "CanvasTileMapOptions": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.CanvasTileMapOptions),
/* harmony export */   "CanvasTileMapOptionsBuilder": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.CanvasTileMapOptionsBuilder),
/* harmony export */   "Cartesian2": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.Cartesian2),
/* harmony export */   "Cartesian3": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.Cartesian3),
/* harmony export */   "CartesianMode": () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_1__.CartesianMode),
/* harmony export */   "CelestialNodeType": () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_7__.CelestialNodeType),
/* harmony export */   "CellCoordinateReference": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.CellCoordinateReference),
/* harmony export */   "ColorValue": () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_7__.ColorValue),
/* harmony export */   "ContentUpdateEventArgs": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.ContentUpdateEventArgs),
/* harmony export */   "Current": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Current),
/* harmony export */   "DemInfos": () => (/* reexport safe */ _dem_index__WEBPACK_IMPORTED_MODULE_10__.DemInfos),
/* harmony export */   "DemTileWebClient": () => (/* reexport safe */ _dem_index__WEBPACK_IMPORTED_MODULE_10__.DemTileWebClient),
/* harmony export */   "Distance": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Distance),
/* harmony export */   "EPSG3857": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.EPSG3857),
/* harmony export */   "Ellipsoid": () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_1__.Ellipsoid),
/* harmony export */   "Envelope": () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_2__.Envelope),
/* harmony export */   "EventArgs": () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_0__.EventArgs),
/* harmony export */   "EventEmitter": () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_0__.EventEmitter),
/* harmony export */   "EventState": () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_0__.EventState),
/* harmony export */   "EvictionReason": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.EvictionReason),
/* harmony export */   "FetchError": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.FetchError),
/* harmony export */   "FetchResult": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.FetchResult),
/* harmony export */   "Float32TileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.Float32TileCodec),
/* harmony export */   "Float32TileCodecOptions": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.Float32TileCodecOptions),
/* harmony export */   "Float32TileCodecOptionsBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.Float32TileCodecOptionsBuilder),
/* harmony export */   "Geo2": () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_2__.Geo2),
/* harmony export */   "Geo3": () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_2__.Geo3),
/* harmony export */   "GeodeticGridPainter": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.GeodeticGridPainter),
/* harmony export */   "GeodeticGridView": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.GeodeticGridView),
/* harmony export */   "GeodeticGridViewOptions": () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.GeodeticGridViewOptions),
/* harmony export */   "GeodeticSystem": () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_1__.GeodeticSystem),
/* harmony export */   "Google": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.Google),
/* harmony export */   "GoogleMap2DLayerCode": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.GoogleMap2DLayerCode),
/* harmony export */   "GoogleMap2DUrlBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.GoogleMap2DUrlBuilder),
/* harmony export */   "HSLColor": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.HSLColor),
/* harmony export */   "ImageDataTileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.ImageDataTileCodec),
/* harmony export */   "ImageDataTileCodecOptions": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.ImageDataTileCodecOptions),
/* harmony export */   "ImageDataTileCodecOptionsBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.ImageDataTileCodecOptionsBuilder),
/* harmony export */   "ImageTileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.ImageTileCodec),
/* harmony export */   "IsTileContentView": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.IsTileContentView),
/* harmony export */   "JsonTileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.JsonTileCodec),
/* harmony export */   "KeplerOrbitBase": () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_7__.KeplerOrbitBase),
/* harmony export */   "KnownPlaces": () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_2__.KnownPlaces),
/* harmony export */   "LODTransitionMode": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.LODTransitionMode),
/* harmony export */   "Luminosity": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Luminosity),
/* harmony export */   "MapBox": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.MapBox),
/* harmony export */   "MapBoxTerrainDemV1UrlBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   "MapZen": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.MapZen),
/* harmony export */   "MapZenDemUrlBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.MapZenDemUrlBuilder),
/* harmony export */   "MapboxAltitudeDecoder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.MapboxAltitudeDecoder),
/* harmony export */   "MapzenAltitudeDecoder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.MapzenAltitudeDecoder),
/* harmony export */   "Mass": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Mass),
/* harmony export */   "MemoryCache": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.MemoryCache),
/* harmony export */   "MorganKeenanClass": () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_7__.MorganKeenanClass),
/* harmony export */   "ObjectPool": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.ObjectPool),
/* harmony export */   "ObjectPoolOptions": () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_9__.ObjectPoolOptions),
/* harmony export */   "Observable": () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_0__.Observable),
/* harmony export */   "Observer": () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_0__.Observer),
/* harmony export */   "Power": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Power),
/* harmony export */   "PropertyChangedEventArgs": () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_0__.PropertyChangedEventArgs),
/* harmony export */   "Quantity": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Quantity),
/* harmony export */   "QuantityRange": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.QuantityRange),
/* harmony export */   "RGBAColor": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.RGBAColor),
/* harmony export */   "RGBATileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.RGBATileCodec),
/* harmony export */   "RGBTileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.RGBTileCodec),
/* harmony export */   "Range": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Range),
/* harmony export */   "Rectangle": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.Rectangle),
/* harmony export */   "Scalar": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Scalar),
/* harmony export */   "Side": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.Side),
/* harmony export */   "Size2": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.Size2),
/* harmony export */   "Size3": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.Size3),
/* harmony export */   "SpectralClass": () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_7__.SpectralClass),
/* harmony export */   "Speed": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Speed),
/* harmony export */   "StarColor": () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_7__.StarColor),
/* harmony export */   "Temperature": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Temperature),
/* harmony export */   "TerrainGridOptions": () => (/* reexport safe */ _meshes_index__WEBPACK_IMPORTED_MODULE_6__.TerrainGridOptions),
/* harmony export */   "TerrainGridOptionsBuilder": () => (/* reexport safe */ _meshes_index__WEBPACK_IMPORTED_MODULE_6__.TerrainGridOptionsBuilder),
/* harmony export */   "TerrainNormalizedGridBuilder": () => (/* reexport safe */ _meshes_index__WEBPACK_IMPORTED_MODULE_6__.TerrainNormalizedGridBuilder),
/* harmony export */   "TextTileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TextTileCodec),
/* harmony export */   "Tile": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.Tile),
/* harmony export */   "TileAddress": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileAddress),
/* harmony export */   "TileBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileBuilder),
/* harmony export */   "TileContentManager": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileContentManager),
/* harmony export */   "TileContentView": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileContentView),
/* harmony export */   "TileMapContext": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileMapContext),
/* harmony export */   "TileMapView": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileMapView),
/* harmony export */   "TileMetrics": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileMetrics),
/* harmony export */   "TileMetricsOptions": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileMetricsOptions),
/* harmony export */   "TileMetricsOptionsBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileMetricsOptionsBuilder),
/* harmony export */   "TileWebClient": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileWebClient),
/* harmony export */   "TileWebClientOptions": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileWebClientOptions),
/* harmony export */   "TileWebClientOptionsBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.TileWebClientOptionsBuilder),
/* harmony export */   "Timespan": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Timespan),
/* harmony export */   "Unit": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Unit),
/* harmony export */   "UpdateEventArgs": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.UpdateEventArgs),
/* harmony export */   "UpdateInfos": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.UpdateInfos),
/* harmony export */   "UpdateReason": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.UpdateReason),
/* harmony export */   "Voltage": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Voltage),
/* harmony export */   "Volume": () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_5__.Volume),
/* harmony export */   "WebTileUrlBuilder": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.WebTileUrlBuilder),
/* harmony export */   "XmlDocumentTileCodec": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.XmlDocumentTileCodec),
/* harmony export */   "isBox": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.isBox),
/* harmony export */   "isCartesian3": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.isCartesian3),
/* harmony export */   "isEnvelope": () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_2__.isEnvelope),
/* harmony export */   "isLocation": () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_2__.isLocation),
/* harmony export */   "isRectangle": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.isRectangle),
/* harmony export */   "isSize2": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.isSize2),
/* harmony export */   "isSize3": () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_3__.isSize3),
/* harmony export */   "isTileAddress": () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_8__.isTileAddress)
/* harmony export */ });
/* harmony import */ var _events_index__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./events/index */ "./dist/events/index.js");
/* harmony import */ var _geodesy_index__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geodesy/index */ "./dist/geodesy/index.js");
/* harmony import */ var _geography_index__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geography/index */ "./dist/geography/index.js");
/* harmony import */ var _geometry_index__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geometry/index */ "./dist/geometry/index.js");
/* harmony import */ var _map_index__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./map/index */ "./dist/map/index.js");
/* harmony import */ var _math_index__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./math/index */ "./dist/math/index.js");
/* harmony import */ var _meshes_index__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./meshes/index */ "./dist/meshes/index.js");
/* harmony import */ var _space_index__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./space/index */ "./dist/space/index.js");
/* harmony import */ var _tiles_index__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./tiles/index */ "./dist/tiles/index.js");
/* harmony import */ var _utils_index__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./utils/index */ "./dist/utils/index.js");
/* harmony import */ var _dem_index__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./dem/index */ "./dist/dem/index.js");












//# sourceMappingURL=index.js.map
})();

SPACEXR = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=spacexr.1.0.0.js.map