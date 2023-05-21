var SPACEXR;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dist/materials/index.js":
/*!*********************************!*\
  !*** ./dist/materials/index.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MapMaterial": () => (/* reexport safe */ _material_terrain_map__WEBPACK_IMPORTED_MODULE_0__.MapMaterial),
/* harmony export */   "MapMaterialOptions": () => (/* reexport safe */ _material_terrain_map__WEBPACK_IMPORTED_MODULE_0__.MapMaterialOptions),
/* harmony export */   "WireframeMaterialOptions": () => (/* reexport safe */ _material_wireframe__WEBPACK_IMPORTED_MODULE_1__.WireframeMaterialOptions)
/* harmony export */ });
/* harmony import */ var _material_terrain_map__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./material.terrain.map */ "./dist/materials/material.terrain.map.js");
/* harmony import */ var _material_wireframe__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./material.wireframe */ "./dist/materials/material.wireframe.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/materials/material.terrain.map.js":
/*!************************************************!*\
  !*** ./dist/materials/material.terrain.map.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MapMaterial": () => (/* binding */ MapMaterial),
/* harmony export */   "MapMaterialOptions": () => (/* binding */ MapMaterialOptions)
/* harmony export */ });
/* harmony import */ var _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babylonjs/core */ "@babylonjs/core");
/* harmony import */ var _babylonjs_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babylonjs_core__WEBPACK_IMPORTED_MODULE_0__);

class MapMaterialOptions {
}
class MapMaterial extends _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.ShaderMaterial {
    constructor(name, scene) {
        super(name, scene, { vertex: MapMaterial.MapKeyword, fragment: MapMaterial.MapKeyword }, MapMaterial.ShaderOptions);
    }
}
MapMaterial.MapKeyword = "tilemap";
MapMaterial.ShaderOptions = {
    attributes: ["position", "normal"],
    uniforms: ["world", "worldViewProjection", "altitudes", "lightPosition", "color"],
};

//# sourceMappingURL=material.terrain.map.js.map

/***/ }),

/***/ "./dist/materials/material.wireframe.js":
/*!**********************************************!*\
  !*** ./dist/materials/material.wireframe.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WireframeMaterialOptions": () => (/* binding */ WireframeMaterialOptions)
/* harmony export */ });
class WireframeMaterialOptions {
}
//# sourceMappingURL=material.wireframe.js.map

/***/ }),

/***/ "./dist/terrain/index.js":
/*!*******************************!*\
  !*** ./dist/terrain/index.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SurfaceMapDisplay": () => (/* reexport safe */ _terrain_mapDisplay__WEBPACK_IMPORTED_MODULE_1__.SurfaceMapDisplay),
/* harmony export */   "SurfaceTileMap": () => (/* reexport safe */ _terrain_map__WEBPACK_IMPORTED_MODULE_2__.SurfaceTileMap),
/* harmony export */   "TerrainTile": () => (/* reexport safe */ _terrain_tile__WEBPACK_IMPORTED_MODULE_0__.TerrainTile)
/* harmony export */ });
/* harmony import */ var _terrain_tile__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./terrain.tile */ "./dist/terrain/terrain.tile.js");
/* harmony import */ var _terrain_mapDisplay__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./terrain.mapDisplay */ "./dist/terrain/terrain.mapDisplay.js");
/* harmony import */ var _terrain_map__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./terrain.map */ "./dist/terrain/terrain.map.js");




//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/terrain/terrain.map.js":
/*!*************************************!*\
  !*** ./dist/terrain/terrain.map.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SurfaceTileMap": () => (/* binding */ SurfaceTileMap)
/* harmony export */ });
/* harmony import */ var _dev_core_src_map__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @dev/core/src/map */ "../core/dist/map/map.js");
/* harmony import */ var _dev_core_src_meshes_terrain_grid__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @dev/core/src/meshes/terrain.grid */ "../core/dist/meshes/terrain.grid.js");
/* harmony import */ var _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babylonjs/core */ "@babylonjs/core");
/* harmony import */ var _babylonjs_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babylonjs_core__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _terrain_tile__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./terrain.tile */ "./dist/terrain/terrain.tile.js");
/* harmony import */ var _materials__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../materials */ "./dist/materials/material.terrain.map.js");





class SurfaceTileMap extends _dev_core_src_map__WEBPACK_IMPORTED_MODULE_1__.AbstractDisplayMap {
    constructor(name, scene, display, datasource, metrics, center, lod) {
        super(display, datasource, metrics, center, lod);
        this._pivot = new _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.TransformNode(`__${name}_root__`, scene);
        this._pivot.setParent(display);
        this._translate = new _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.TransformNode(`__${name}_trans__`, scene);
        this._translate.setParent(this._pivot);
        this._grid = this.buildGrid();
        this._template = this.buildMesh(name, scene);
    }
    buildGrid() {
        const o = new _dev_core_src_meshes_terrain_grid__WEBPACK_IMPORTED_MODULE_2__.TerrainGridOptions(this.metrics.tileSize);
        return new _dev_core_src_meshes_terrain_grid__WEBPACK_IMPORTED_MODULE_2__.TerrainNormalizedGridBuilder().withOptions(o).build(new _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.VertexData());
    }
    buildMesh(name, scene) {
        const mesh = new _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.Mesh(name, scene);
        this._grid.applyToMesh(mesh, true);
        mesh.material = new _materials__WEBPACK_IMPORTED_MODULE_3__.MapMaterial(`${name}_material`, scene);
        mesh.registerInstancedBuffer("address", 3);
        return mesh;
    }
    buildInstance(name, tile) {
        const instance = this._template.createInstance(name);
        const a = tile.address;
        instance.instancedBuffers.address = new _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.Vector3(a.x, a.y, a.levelOfDetail);
        return instance;
    }
    buildMapTile(t) {
        return new _terrain_tile__WEBPACK_IMPORTED_MODULE_4__.TerrainTile(t);
    }
    onDeleted(key, tile) {
        tile.dispose();
    }
    onAdded(key, tile) {
        const instance = this.buildInstance(key, tile);
        instance.setParent(this._translate);
        tile.mesh = instance;
    }
    invalidateDisplay() {
        this._pivot.scaling = new _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.Vector3(this._scale, 1, this._scale);
        this._pivot.rotation.y = _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.Tools.ToRadians(this.rotation);
        this._translate.position.x = -this._center.x;
        this._translate.position.y = -this._center.y;
    }
    invalidateTiles(added, removed) { }
}
//# sourceMappingURL=terrain.map.js.map

/***/ }),

/***/ "./dist/terrain/terrain.mapDisplay.js":
/*!********************************************!*\
  !*** ./dist/terrain/terrain.mapDisplay.js ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SurfaceMapDisplay": () => (/* binding */ SurfaceMapDisplay)
/* harmony export */ });
/* harmony import */ var _dev_core_src_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @dev/core/src/geometry/geometry.interfaces */ "../core/dist/geometry/geometry.interfaces.js");
/* harmony import */ var _dev_core_src_geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @dev/core/src/geometry/geometry.cartesian */ "../core/dist/geometry/geometry.cartesian.js");
/* harmony import */ var _dev_core_src_geometry_geometry_size__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @dev/core/src/geometry/geometry.size */ "../core/dist/geometry/geometry.size.js");
/* harmony import */ var _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babylonjs/core */ "@babylonjs/core");
/* harmony import */ var _babylonjs_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babylonjs_core__WEBPACK_IMPORTED_MODULE_0__);




class SurfaceMapDisplay extends _babylonjs_core__WEBPACK_IMPORTED_MODULE_0__.TransformNode {
    static FromResolution(name, scene, dimensions, resolutions) {
        const d = new SurfaceMapDisplay(name, scene, dimensions, 0);
        d._dpi.x = resolutions.x / dimensions.width;
        d._dpi.y = resolutions.y / dimensions.height;
        d._dpi.z = resolutions.z / dimensions.thickness;
        return d;
    }
    constructor(name, scene, dimensions, dpi) {
        super(name, scene);
        this._dimensions = dimensions;
        this._dpi = (0,_dev_core_src_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_1__.isCartesian3)(dpi) ? new _dev_core_src_geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3(dpi.x, dpi.y, dpi.z) : new _dev_core_src_geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3(dpi, dpi, dpi);
    }
    get resolution() {
        return new _dev_core_src_geometry_geometry_size__WEBPACK_IMPORTED_MODULE_3__.Size2(this._dimensions.width * this._dpi.y, this._dimensions.height * this._dpi.z);
    }
}
//# sourceMappingURL=terrain.mapDisplay.js.map

/***/ }),

/***/ "./dist/terrain/terrain.tile.js":
/*!**************************************!*\
  !*** ./dist/terrain/terrain.tile.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TerrainTile": () => (/* binding */ TerrainTile)
/* harmony export */ });
class TerrainTile {
    constructor(delegate, mesh) {
        this._delegate = delegate;
        this._mesh = mesh;
    }
    get delegate() {
        return this._delegate;
    }
    get mesh() {
        return this._mesh;
    }
    set mesh(v) {
        this._mesh = v;
    }
    get address() {
        return this._delegate.address;
    }
    get content() {
        return this._delegate.content;
    }
    get rect() {
        return this._delegate.rect;
    }
    get bounds() {
        return this._delegate.bounds;
    }
    dispose() {
        this._mesh?.dispose();
        this._mesh = undefined;
        return this;
    }
}
//# sourceMappingURL=terrain.tile.js.map

/***/ }),

/***/ "../core/dist/events/events.args.js":
/*!******************************************!*\
  !*** ../core/dist/events/events.args.js ***!
  \******************************************/
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

/***/ "../core/dist/events/events.observable.js":
/*!************************************************!*\
  !*** ../core/dist/events/events.observable.js ***!
  \************************************************/
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
    constructor(callback, mask, scope = null) {
        this.callback = callback;
        this.mask = mask;
        this.scope = scope;
        this._willBeUnregistered = false;
        this.unregisterOnNextCall = false;
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
        const observer = new Observer(callback, mask, scope);
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

/***/ "../core/dist/geodesy/geodesy.ellipsoid.js":
/*!*************************************************!*\
  !*** ../core/dist/geodesy/geodesy.ellipsoid.js ***!
  \*************************************************/
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

/***/ "../core/dist/geography/geography.envelope.js":
/*!****************************************************!*\
  !*** ../core/dist/geography/geography.envelope.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Envelope": () => (/* binding */ Envelope)
/* harmony export */ });
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../math/math */ "../core/dist/math/math.js");
/* harmony import */ var _geography_interfaces__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geography.interfaces */ "../core/dist/geography/geography.interfaces.js");
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.position */ "../core/dist/geography/geography.position.js");
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry/geometry.size */ "../core/dist/geometry/geometry.size.js");




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

/***/ "../core/dist/geography/geography.interfaces.js":
/*!******************************************************!*\
  !*** ../core/dist/geography/geography.interfaces.js ***!
  \******************************************************/
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

/***/ "../core/dist/geography/geography.position.js":
/*!****************************************************!*\
  !*** ../core/dist/geography/geography.position.js ***!
  \****************************************************/
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

/***/ "../core/dist/geometry/geometry.cartesian.js":
/*!***************************************************!*\
  !*** ../core/dist/geometry/geometry.cartesian.js ***!
  \***************************************************/
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

/***/ "../core/dist/geometry/geometry.interfaces.js":
/*!****************************************************!*\
  !*** ../core/dist/geometry/geometry.interfaces.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
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
    return b.top !== undefined && b.left !== undefined && b.right !== undefined && b.bottom !== undefined;
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

/***/ "../core/dist/geometry/geometry.rectangle.js":
/*!***************************************************!*\
  !*** ../core/dist/geometry/geometry.rectangle.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Rectangle": () => (/* binding */ Rectangle)
/* harmony export */ });
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.cartesian */ "../core/dist/geometry/geometry.cartesian.js");

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
        const r = this.right;
        const b = this.bottom;
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(this.left, this.top);
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(r, this.top);
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(r, b);
        yield new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(this.left, b);
    }
    clone() {
        return new Rectangle(this.x, this.y, this.width, this.height);
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
    get center() {
        return new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2(this.x + this.width / 2, this.y + this.height / 2);
    }
    intersect(other) {
        if (!other || this.bottom < other.top || this.top > other.bottom || this.left > other.right || this.right < other.left) {
            return false;
        }
        return true;
    }
    intersection(other, ref) {
        if (!this.intersect(other)) {
            return undefined;
        }
        const target = ref || Rectangle.Zero();
        target.y = Math.max(this.top, other.top);
        target.height = Math.min(this.bottom, other.bottom) - target.y;
        target.x = Math.max(this.left, other.left);
        target.width = Math.min(this.right, other.right) - target.x;
        return target;
    }
    unionInPlace(other) {
        const x1 = Math.min(this.x, other.x);
        const y1 = Math.min(this.y, other.y);
        const x2 = Math.max(this.right, other.right);
        const y2 = Math.max(this.bottom, other.bottom);
        this.x = x1;
        this.y = y1;
        this.width = x2 - x1;
        this.height = y2 - y1;
        return this;
    }
    contains(x, y) {
        return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
    }
    toString() {
        return `left:${this.left}, top:${this.top}, width:${this.width}, height:${this.height}`;
    }
}
//# sourceMappingURL=geometry.rectangle.js.map

/***/ }),

/***/ "../core/dist/geometry/geometry.size.js":
/*!**********************************************!*\
  !*** ../core/dist/geometry/geometry.size.js ***!
  \**********************************************/
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

/***/ "../core/dist/map/map.js":
/*!*******************************!*\
  !*** ../core/dist/map/map.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractDisplayMap": () => (/* binding */ AbstractDisplayMap)
/* harmony export */ });
/* harmony import */ var _tiles_tile_mapview__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles/tile.mapview */ "../core/dist/tiles/tile.mapview.js");
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography/geography.position */ "../core/dist/geography/geography.position.js");
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geometry/geometry.cartesian */ "../core/dist/geometry/geometry.cartesian.js");



class AbstractDisplayMap {
    constructor(display, datasource, metrics, center, lod) {
        this._lod = 0;
        this._scale = 1;
        this._center = _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
        this._display = display;
        this._view = new _tiles_tile_mapview__WEBPACK_IMPORTED_MODULE_1__.TileMapView(datasource, metrics, display.resolution.width, display.resolution.height, center || _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__.Geo2.Zero(), lod || metrics.minLOD);
        this._view.updateObservable.add((e) => this.onUpdate(e));
        this._activ = new Map();
        this._view.validate();
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
    setRotation(r) {
        this._view.setRotation(r);
        this._view.validate();
        return this;
    }
    zoomIn(delta) {
        this._view.zoomIn(delta);
        this._view.validate();
        return this;
    }
    zoomOut(delta) {
        this._view.zoomOut(delta);
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
    get rotation() {
        return this._view.rotation;
    }
    onUpdate(args) {
        if (!args) {
            return;
        }
        switch (args.reason) {
            case _tiles_tile_mapview__WEBPACK_IMPORTED_MODULE_1__.UpdateReason.tileReady: {
                this.onUpdateTiles(args);
                break;
            }
            case _tiles_tile_mapview__WEBPACK_IMPORTED_MODULE_1__.UpdateReason.viewChanged:
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
    processRemoved(args) {
        if (args.removed && args.removed.length != 0) {
            for (const t of args.removed) {
                const key = t.address.quadkey;
                const old = this._activ.get(key);
                if (old) {
                    this._activ.delete(key);
                    this.onDeleted(key, old);
                }
            }
        }
    }
    processAdded(args) {
        if (args.added && args.added.length != 0) {
            const allocated = [];
            for (const t of args.added) {
                const key = t.address.quadkey;
                if (!this._activ.has(key)) {
                    const t1 = this.buildMapTile(t);
                    allocated.push(t1);
                    this._activ.set(key, t1);
                    this.onAdded(key, t1);
                }
            }
            return allocated;
        }
        return undefined;
    }
    buildMapTile(t) {
        return t;
    }
}
//# sourceMappingURL=map.js.map

/***/ }),

/***/ "../core/dist/math/math.js":
/*!*********************************!*\
  !*** ../core/dist/math/math.js ***!
  \*********************************/
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

/***/ "../core/dist/meshes/terrain.grid.js":
/*!*******************************************!*\
  !*** ../core/dist/meshes/terrain.grid.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GridCoordinateReference": () => (/* binding */ GridCoordinateReference),
/* harmony export */   "TerrainGridOptions": () => (/* binding */ TerrainGridOptions),
/* harmony export */   "TerrainNormalizedGridBuilder": () => (/* binding */ TerrainNormalizedGridBuilder)
/* harmony export */ });
var GridCoordinateReference;
(function (GridCoordinateReference) {
    GridCoordinateReference[GridCoordinateReference["center"] = 0] = "center";
    GridCoordinateReference[GridCoordinateReference["upperLeft"] = 1] = "upperLeft";
})(GridCoordinateReference || (GridCoordinateReference = {}));
class TerrainGridOptions {
    constructor(size = TerrainGridOptions.DefaultGridSize, height, ref) {
        this.width = size;
        this.height = height || size;
        this.coordinateReference = ref || TerrainGridOptions.DefaultCoordinateReference;
        this.invertIndices = TerrainGridOptions.DefaultInvertIndices;
    }
    clone() {
        const other = new TerrainGridOptions(this.width, this.height, this.coordinateReference);
        other.invertIndices = this.invertIndices;
        return other;
    }
}
TerrainGridOptions.Shared = new TerrainGridOptions();
TerrainGridOptions.DefaultGridSize = 256;
TerrainGridOptions.DefaultInvertIndices = false;
TerrainGridOptions.DefaultCoordinateReference = GridCoordinateReference.center;

class TerrainNormalizedGridBuilder {
    constructor(options = null) {
        this.withOptions(options);
    }
    withOptions(options) {
        this._o = { ...TerrainGridOptions.Shared, ...options };
        return this;
    }
    build(data) {
        data = data || {};
        const w = this._o?.width || TerrainGridOptions.DefaultGridSize;
        const h = this._o?.height || w;
        const sx = 1;
        const sy = 1;
        const positions = [];
        const indices = [];
        const isCentered = this._o?.coordinateReference == GridCoordinateReference.center;
        const x0 = isCentered ? -0.5 : 0;
        const y0 = isCentered ? 0.5 : 0;
        const dx = 1 / (w - 1);
        const dy = (isCentered ? 1 : -1) / (h - 1);
        for (let row = 0; row < h; row++) {
            const v = row * dy;
            const y = (y0 + v) * sy;
            for (let column = 0; column < w; column++) {
                const u = column * dx;
                const x = (x0 + u) * sx;
                const z = 0;
                positions.push(x, y, z);
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
                        indices.push(idx1, idx4, idx2, idx2, idx4, idx3);
                    }
                    else {
                        indices.push(idx1, idx2, idx4, idx2, idx3, idx4);
                    }
                }
                else {
                    if (this._o?.invertIndices) {
                        indices.push(idx1, idx3, idx2, idx3, idx1, idx4);
                    }
                    else {
                        indices.push(idx1, idx2, idx3, idx3, idx4, idx1);
                    }
                }
            }
        }
        data.indices = indices;
        data.positions = positions;
        return data;
    }
}
//# sourceMappingURL=terrain.grid.js.map

/***/ }),

/***/ "../core/dist/tiles/tile.mapview.js":
/*!******************************************!*\
  !*** ../core/dist/tiles/tile.mapview.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TileMapLevel": () => (/* binding */ TileMapLevel),
/* harmony export */   "TileMapView": () => (/* binding */ TileMapView),
/* harmony export */   "UpdateEventArgs": () => (/* binding */ UpdateEventArgs),
/* harmony export */   "UpdateReason": () => (/* binding */ UpdateReason)
/* harmony export */ });
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography/geography.position */ "../core/dist/geography/geography.position.js");
/* harmony import */ var _events_events_observable__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../events/events.observable */ "../core/dist/events/events.observable.js");
/* harmony import */ var _tiles_geography__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./tiles.geography */ "../core/dist/tiles/tiles.geography.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../math/math */ "../core/dist/math/math.js");
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../geometry/geometry.size */ "../core/dist/geometry/geometry.size.js");
/* harmony import */ var _events_events_args__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../events/events.args */ "../core/dist/events/events.args.js");
/* harmony import */ var _utils_cache__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/cache */ "../core/dist/utils/cache.js");
/* harmony import */ var _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../geometry/geometry.rectangle */ "../core/dist/geometry/geometry.rectangle.js");
/* harmony import */ var _tiles_address__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./tiles.address */ "../core/dist/tiles/tiles.address.js");
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./tiles */ "../core/dist/tiles/tiles.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./tiles.metrics */ "../core/dist/tiles/tiles.metrics.js");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! .. */ "../core/dist/geometry/geometry.cartesian.js");












class TileMapLevel {
    constructor() {
        this._lod = 0;
        this._scale = 1;
        this._center = ___WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero();
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
class UpdateEventArgs extends _events_events_args__WEBPACK_IMPORTED_MODULE_1__.EventArgs {
    constructor(source, reason, lod, scale, center, added, removed) {
        super(source);
        this._reason = reason;
        this._lod = lod;
        this._scale = scale;
        this._center = center;
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
    get lod() {
        return this._lod;
    }
    get scale() {
        return this._scale;
    }
    get center() {
        return this._center;
    }
}
class TileMapView {
    constructor(datasource, metrics, width, height, center, lod, cache) {
        this._w = 0;
        this._h = 0;
        this._lod = 0;
        this._center = _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__.Geo2.Zero();
        this._valid = false;
        this._cache = cache || new _utils_cache__WEBPACK_IMPORTED_MODULE_3__.MemoryCache();
        this._datasource = datasource;
        this._metrics = metrics || _tiles_geography__WEBPACK_IMPORTED_MODULE_4__.EPSG3857.Shared;
        this.invalidateSize(width, height).setView(center, lod);
        this._level = new TileMapLevel();
        this._rotation = 0;
        this._cosangle = 0;
        this._sinangle = 1;
    }
    get resizeObservable() {
        this._resizeObservable = this._resizeObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_5__.Observable(this.onResizeObserverAdded.bind(this));
        return this._resizeObservable;
    }
    get centerObservable() {
        this._centerObservable = this._centerObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_5__.Observable(this.onCenterObserverAdded.bind(this));
        return this._centerObservable;
    }
    get zoomObservable() {
        this._zoomObservable = this._zoomObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_5__.Observable(this.onZoomObserverAdded.bind(this));
        return this._zoomObservable;
    }
    get updateObservable() {
        this._updateObservable = this._updateObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_5__.Observable(this.onUpdateObserverAdded.bind(this));
        return this._updateObservable;
    }
    get datasource() {
        return this._datasource;
    }
    get level() {
        return this._level;
    }
    get levelOfDetail() {
        return this._lod;
    }
    get center() {
        return this._center;
    }
    get rotation() {
        return this._rotation;
    }
    get metrics() {
        return this._metrics;
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
                const old = new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_6__.Size2(this._w, this._h);
                const value = new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_6__.Size2(w, h);
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
    setView(center, zoom, rotation) {
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
        if (rotation) {
            this.setRotation(rotation);
        }
        return this;
    }
    setZoom(zoom) {
        const lod = _math_math__WEBPACK_IMPORTED_MODULE_7__.Scalar.Clamp(zoom, this.metrics.minLOD, this.metrics.maxLOD);
        if (this.levelOfDetail != lod) {
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                const old = this._lod;
                this._lod = lod;
                const e = new _events_events_args__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, zoom);
                this._zoomObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this._lod = lod;
            this.invalidate();
        }
        return this;
    }
    setRotation(r) {
        const r0 = r % 360;
        this._rotation = r0 < 0 ? 360 + r0 : r0;
        const rad = this._rotation * _math_math__WEBPACK_IMPORTED_MODULE_7__.Scalar.DEG2RAD;
        this._cosangle = Math.cos(rad);
        this._sinangle = Math.sin(rad);
        this.invalidate();
        return this;
    }
    zoomIn(delta) {
        return this.setZoom(this.levelOfDetail + Math.abs(delta));
    }
    zoomOut(delta) {
        return this.setZoom(this.levelOfDetail - Math.abs(delta));
    }
    translate(tx, ty) {
        if (this._rotation) {
            const p = this.rotatePoint(tx, ty);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this.levelOfDetail);
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        const center = this.metrics.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        return this.setView(center);
    }
    rotate(r) {
        return this.setRotation(this._rotation + r);
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
        this._level._lod = Math.round(this.levelOfDetail);
        this.doValidateLevel(this._level);
    }
    doValidateLevel(level) {
        const lod = level.lod;
        let scale = _tiles_metrics__WEBPACK_IMPORTED_MODULE_8__.TileMetrics.GetScale(this.levelOfDetail);
        this._level._scale = scale;
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        this._level._center = pixelCenterXY;
        const w = this.width / scale;
        const h = this.height / scale;
        let x0 = Math.round(pixelCenterXY.x - w / 2);
        let y0 = Math.round(pixelCenterXY.y - h / 2);
        let bounds = new _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_9__.Rectangle(x0, y0, w, h);
        if (this._rotation) {
            const corners = bounds.points();
            const rotated = Array.from(this.rotatePoints(bounds.center, ...corners));
            bounds = _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_9__.Rectangle.FromPoints(...rotated);
        }
        let nwTileXY = this.metrics.getPixelXYToTileXY(bounds.left, bounds.top);
        let seTileXY = this.metrics.getPixelXYToTileXY(bounds.right, bounds.bottom);
        const tileXYBounds = _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_9__.Rectangle.FromPoints(nwTileXY, seTileXY);
        x0 = tileXYBounds.left;
        y0 = tileXYBounds.top;
        const x1 = tileXYBounds.right;
        const y1 = tileXYBounds.bottom;
        const remains = new Array();
        let added = new Array();
        const builder = new _tiles__WEBPACK_IMPORTED_MODULE_10__.TileBuilder().withMetrics(this.metrics);
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const a = new _tiles_address__WEBPACK_IMPORTED_MODULE_11__.TileAddress(x, y, lod);
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
                this._datasource
                    .fetchAsync(a, this, t)
                    .then((result) => {
                    const view = result.userArgs[0];
                    const t = result.userArgs[1];
                    if (result.content) {
                        t.content = result.content;
                        view.onTileReady(t);
                        return;
                    }
                    view.onTileNotFound(t);
                })
                    .catch((reason) => {
                });
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
        added = added.filter((t) => t.content !== undefined && t.content !== null);
        deleted = deleted.filter((t) => t.content !== undefined && t.content !== null);
        const updateEvent = new UpdateEventArgs(this, UpdateReason.viewChanged, this._level.lod, this._level.scale, this._level.center, added.length ? added : undefined, deleted.length ? deleted : undefined);
        this.updateObservable.notifyObservers(updateEvent);
    }
    onTileReady(t) {
        if (t.address.levelOfDetail == this._level.lod) {
            this._level.tiles.set(t.address.quadkey, t);
            const added = [t];
            const updateEvent = new UpdateEventArgs(this, UpdateReason.tileReady, this._level.lod, this._level.scale, this._level.center, added);
            this.updateObservable.notifyObservers(updateEvent);
        }
    }
    onTileNotFound(t) {
        console.log("tile not found", t.address);
        t.content = null;
    }
    *rotatePoints(center, ...points) {
        for (const p of points) {
            yield this.rotatePoint(p.x, p.y, center);
        }
    }
    rotatePoint(x, y, center) {
        const translatedX = center ? x - center.x : x;
        const translatedY = center ? y - center.y : y;
        const rotatedX = translatedX * this._cosangle + translatedY * this._sinangle;
        const rotatedY = translatedY * this._cosangle - translatedX * this._sinangle;
        return new ___WEBPACK_IMPORTED_MODULE_0__.Cartesian2(center ? rotatedX + center.x : rotatedX, center ? rotatedY + center.y : rotatedY);
    }
}
//# sourceMappingURL=tile.mapview.js.map

/***/ }),

/***/ "../core/dist/tiles/tiles.address.js":
/*!*******************************************!*\
  !*** ../core/dist/tiles/tiles.address.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TileAddress": () => (/* binding */ TileAddress)
/* harmony export */ });
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.metrics */ "../core/dist/tiles/tiles.metrics.js");

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
        return "x:" + this.x + ", y:" + this.y + ", lod:" + this.levelOfDetail + ", k:" + this.quadkey;
    }
}
//# sourceMappingURL=tiles.address.js.map

/***/ }),

/***/ "../core/dist/tiles/tiles.geography.js":
/*!*********************************************!*\
  !*** ../core/dist/tiles/tiles.geography.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EPSG3857": () => (/* binding */ EPSG3857)
/* harmony export */ });
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.metrics */ "../core/dist/tiles/tiles.metrics.js");
/* harmony import */ var _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../geodesy/geodesy.ellipsoid */ "../core/dist/geodesy/geodesy.ellipsoid.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../math/math */ "../core/dist/math/math.js");
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../geography/geography.position */ "../core/dist/geography/geography.position.js");
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry/geometry.cartesian */ "../core/dist/geometry/geometry.cartesian.js");





class EPSG3857 extends _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__.AbstractTileMetrics {
    constructor(options, ellipsoid) {
        super(options);
        this._ellipsoid = ellipsoid || _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__.Ellipsoid.WGS84;
    }
    mapScale(latitude, levelOfDetail, dpi) {
        return this.groundResolution(latitude, levelOfDetail) * dpi * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.INCH2METER;
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

/***/ "../core/dist/tiles/tiles.interfaces.js":
/*!**********************************************!*\
  !*** ../core/dist/tiles/tiles.interfaces.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CellCoordinateReference": () => (/* binding */ CellCoordinateReference),
/* harmony export */   "FetchResult": () => (/* binding */ FetchResult),
/* harmony export */   "isTileAddress": () => (/* binding */ isTileAddress)
/* harmony export */ });
function isTileAddress(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.x !== undefined && b.y !== undefined && b.levelOfDetail !== undefined;
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

/***/ "../core/dist/tiles/tiles.js":
/*!***********************************!*\
  !*** ../core/dist/tiles/tiles.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Tile": () => (/* binding */ Tile),
/* harmony export */   "TileBuilder": () => (/* binding */ TileBuilder)
/* harmony export */ });
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../geometry/geometry.size */ "../core/dist/geometry/geometry.size.js");
/* harmony import */ var _geography_geography_position__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography/geography.position */ "../core/dist/geography/geography.position.js");
/* harmony import */ var _geography_geography_envelope__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geography/geography.envelope */ "../core/dist/geography/geography.envelope.js");
/* harmony import */ var _geometry_geometry_rectangle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../geometry/geometry.rectangle */ "../core/dist/geometry/geometry.rectangle.js");
/* harmony import */ var _tiles_address__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.address */ "../core/dist/tiles/tiles.address.js");





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

/***/ "../core/dist/tiles/tiles.metrics.js":
/*!*******************************************!*\
  !*** ../core/dist/tiles/tiles.metrics.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AbstractTileMetrics": () => (/* binding */ AbstractTileMetrics),
/* harmony export */   "TileMetrics": () => (/* binding */ TileMetrics),
/* harmony export */   "TileMetricsOptions": () => (/* binding */ TileMetricsOptions),
/* harmony export */   "TileMetricsOptionsBuilder": () => (/* binding */ TileMetricsOptionsBuilder)
/* harmony export */ });
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.interfaces */ "../core/dist/tiles/tiles.interfaces.js");

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
    static GetScale(lod) {
        let lodOffset = (lod * 1000 - Math.round(lod) * 1000) / 1000;
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        return scale;
    }
    static ToParentKey(key) {
        return key && key.length > 1 ? key.substring(0, key.length - 1) : key;
    }
    static ToChildKey(key) {
        key = key || "";
        return [key.slice() + "0", key.slice() + "1", key.slice() + "2", key.slice() + "3"];
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
}
//# sourceMappingURL=tiles.metrics.js.map

/***/ }),

/***/ "../core/dist/utils/cache.js":
/*!***********************************!*\
  !*** ../core/dist/utils/cache.js ***!
  \***********************************/
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

/***/ "@babylonjs/core":
/*!**************************!*\
  !*** external "BABYLON" ***!
  \**************************/
/***/ ((module) => {

module.exports = BABYLON;

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
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!***********************!*\
  !*** ./dist/index.js ***!
  \***********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MapMaterial": () => (/* reexport safe */ _materials_index__WEBPACK_IMPORTED_MODULE_1__.MapMaterial),
/* harmony export */   "MapMaterialOptions": () => (/* reexport safe */ _materials_index__WEBPACK_IMPORTED_MODULE_1__.MapMaterialOptions),
/* harmony export */   "SurfaceMapDisplay": () => (/* reexport safe */ _terrain_index__WEBPACK_IMPORTED_MODULE_0__.SurfaceMapDisplay),
/* harmony export */   "SurfaceTileMap": () => (/* reexport safe */ _terrain_index__WEBPACK_IMPORTED_MODULE_0__.SurfaceTileMap),
/* harmony export */   "TerrainTile": () => (/* reexport safe */ _terrain_index__WEBPACK_IMPORTED_MODULE_0__.TerrainTile),
/* harmony export */   "WireframeMaterialOptions": () => (/* reexport safe */ _materials_index__WEBPACK_IMPORTED_MODULE_1__.WireframeMaterialOptions)
/* harmony export */ });
/* harmony import */ var _terrain_index__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./terrain/index */ "./dist/terrain/index.js");
/* harmony import */ var _materials_index__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./materials/index */ "./dist/materials/index.js");



//# sourceMappingURL=index.js.map
})();

SPACEXR = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=stellar_landscape_xr.1.0.0.js.map