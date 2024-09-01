var SPACEXR;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dist/cache/cache.js":
/*!*****************************!*\
  !*** ./dist/cache/cache.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CacheEntry: () => (/* binding */ CacheEntry),
/* harmony export */   CacheEntryOptions: () => (/* binding */ CacheEntryOptions),
/* harmony export */   CacheEntryOptionsBuilder: () => (/* binding */ CacheEntryOptionsBuilder),
/* harmony export */   CachePolicy: () => (/* binding */ CachePolicy),
/* harmony export */   CachePolicyBuilder: () => (/* binding */ CachePolicyBuilder),
/* harmony export */   EvictionReason: () => (/* binding */ EvictionReason),
/* harmony export */   MemoryCache: () => (/* binding */ MemoryCache)
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
    clear(predicate) {
        const keys = [...this._cache.keys()];
        for (const k of keys) {
            if (predicate && predicate(k)) {
                this.delete(k);
            }
        }
    }
    any(predicate) {
        if (!predicate)
            return true;
        const keys = [...this._cache.keys()];
        for (const k of keys) {
            if (predicate(k)) {
                return true;
            }
        }
        return false;
    }
    dispose() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }
        this.clear();
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

/***/ "./dist/cache/index.js":
/*!*****************************!*\
  !*** ./dist/cache/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CacheEntry: () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_0__.CacheEntry),
/* harmony export */   CacheEntryOptions: () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_0__.CacheEntryOptions),
/* harmony export */   CacheEntryOptionsBuilder: () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_0__.CacheEntryOptionsBuilder),
/* harmony export */   CachePolicy: () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_0__.CachePolicy),
/* harmony export */   CachePolicyBuilder: () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_0__.CachePolicyBuilder),
/* harmony export */   EvictionReason: () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_0__.EvictionReason),
/* harmony export */   MemoryCache: () => (/* reexport safe */ _cache__WEBPACK_IMPORTED_MODULE_0__.MemoryCache)
/* harmony export */ });
/* harmony import */ var _cache__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./cache */ "./dist/cache/cache.js");

//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/collections/collection.js":
/*!****************************************!*\
  !*** ./dist/collections/collection.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Collection: () => (/* binding */ Collection)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../events */ "./dist/events/events.observable.js");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../types */ "./dist/types.js");
/* harmony import */ var _validable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../validable */ "./dist/validable.js");



class Collection extends _validable__WEBPACK_IMPORTED_MODULE_0__.ValidableBase {
    static Empty() {
        return new Collection();
    }
    constructor(...items) {
        super();
        this._items = Array.from(items);
    }
    get addedObservable() {
        if (!this._addedObservable) {
            this._addedObservable = new _events__WEBPACK_IMPORTED_MODULE_1__.Observable();
        }
        return this._addedObservable;
    }
    get removedObservable() {
        if (!this._removedObservable) {
            this._removedObservable = new _events__WEBPACK_IMPORTED_MODULE_1__.Observable();
        }
        return this._removedObservable;
    }
    get count() {
        return this._items.length;
    }
    *get(predicate, sorted) {
        for (const l of this._items ?? []) {
            if (!predicate || predicate(l))
                yield l;
        }
    }
    add(...item) {
        const added = this._addInternal(item);
        if (added?.length) {
            if (this._addedObservable && this._addedObservable.hasObservers()) {
                this._addedObservable.notifyObservers(added, -1, this, this);
            }
            this.invalidate();
        }
    }
    remove(...item) {
        const removed = this._removeInternal(item);
        if (removed?.length) {
            if (this._removedObservable && this._removedObservable.hasObservers()) {
                this._removedObservable.notifyObservers(removed, -1, this, this);
            }
            this.invalidate();
        }
    }
    clear() {
        if (this._items) {
            const toRemove = Array.from(this._items);
            for (const l of toRemove) {
                this.remove(l);
            }
        }
    }
    dispose() {
        this.clear();
        this._addedObservable?.clear();
        this._removedObservable?.clear();
    }
    [Symbol.iterator]() {
        let pointer = 0;
        let items = this._items;
        const iterator = {
            next() {
                if (pointer < items.length) {
                    return {
                        done: false,
                        value: items[pointer++],
                    };
                }
                return {
                    done: true,
                    value: null,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }
    get isValid() {
        if (!super.isValid) {
            return false;
        }
        return (this._items.every((l) => {
            if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.isValidable)(l)) {
                return l.isValid;
            }
            return true;
        }) ?? true);
    }
    _addInternal(items) {
        this._items.push(...items);
        return items;
    }
    _removeInternal(items) {
        let removed = [];
        for (const item of items) {
            const i = this._items.indexOf(item);
            if (i >= 0) {
                removed.push(...this._items.splice(i, 1));
            }
        }
        return removed;
    }
}
//# sourceMappingURL=collection.js.map

/***/ }),

/***/ "./dist/collections/orderedCollection.js":
/*!***********************************************!*\
  !*** ./dist/collections/orderedCollection.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OrderedCollection: () => (/* binding */ OrderedCollection)
/* harmony export */ });
/* harmony import */ var _collection__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./collection */ "./dist/collections/collection.js");

class OrderedCollection extends _collection__WEBPACK_IMPORTED_MODULE_0__.Collection {
    constructor(...items) {
        super(...items);
        this._weightCallback = this._onWeightChanged;
    }
    _addInternal(items) {
        const inserted = this._insertInternal(items);
        if (inserted?.length) {
            for (const i of inserted) {
                i.weightChangedObservable?.add(this._weightCallback, -1, false, this, false);
            }
        }
        return inserted;
    }
    _insertInternal(items) {
        if (!items) {
            return [];
        }
        for (const item of items) {
            let index = this._items.findIndex((item) => (item.weight ?? 0) > (item.weight ?? 0));
            if (index === -1) {
                this._items.push(item);
            }
            else {
                this._items.splice(index, 0, item);
            }
        }
        return items;
    }
    _removeInternal(items) {
        const removed = super._removeInternal(items);
        if (removed?.length) {
            for (const i of removed) {
                i.weightChangedObservable?.removeCallback(this._weightCallback, this);
            }
        }
        return removed;
    }
    _onWeightChanged(eventData, eventState) {
        const item = eventData;
        if (item) {
            const inserted = this._insertInternal(super._removeInternal([item]));
            if (inserted?.length) {
                this.invalidate();
            }
        }
    }
}
//# sourceMappingURL=orderedCollection.js.map

/***/ }),

/***/ "./dist/dem/dem.infos.js":
/*!*******************************!*\
  !*** ./dist/dem/dem.infos.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DemInfos: () => (/* binding */ DemInfos)
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

/***/ "./dist/dem/dem.interfaces.js":
/*!************************************!*\
  !*** ./dist/dem/dem.interfaces.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsDemInfos: () => (/* binding */ IsDemInfos)
/* harmony export */ });
function IsDemInfos(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.getDemInfoView !== undefined;
}
//# sourceMappingURL=dem.interfaces.js.map

/***/ }),

/***/ "./dist/dem/dem.tileclient.js":
/*!************************************!*\
  !*** ./dist/dem/dem.tileclient.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DemTileWebClient: () => (/* binding */ DemTileWebClient)
/* harmony export */ });
/* harmony import */ var _tiles_tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles/tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _dem_infos__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./dem.infos */ "./dist/dem/dem.infos.js");


class DemTileWebClient {
    constructor(name, elevationSrc, normalSrc) {
        this._zindex = 0;
        this._name = name;
        this._elevationsDataSource = elevationSrc;
        this._normalsDataSource = normalSrc;
    }
    get name() {
        return this._name;
    }
    get zindex() {
        return this._zindex;
    }
    set zindex(v) {
        this._zindex = v;
    }
    get metrics() {
        return this._elevationsDataSource.metrics;
    }
    async fetchAsync(request, env, ...userArgs) {
        const requests = [];
        requests.push(this._elevationsDataSource.fetchAsync(request, env, ...userArgs));
        if (this._normalsDataSource) {
            requests.push(this._normalsDataSource.fetchAsync(request, env, ...userArgs));
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
        const result = new _tiles_tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.FetchResult(request, new _dem_infos__WEBPACK_IMPORTED_MODULE_1__.DemInfos(elevations, normals), userArgs);
        result.ok = true;
        return result;
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
/* harmony export */   DemInfos: () => (/* reexport safe */ _dem_infos__WEBPACK_IMPORTED_MODULE_1__.DemInfos),
/* harmony export */   DemTileWebClient: () => (/* reexport safe */ _dem_tileclient__WEBPACK_IMPORTED_MODULE_2__.DemTileWebClient),
/* harmony export */   IsDemInfos: () => (/* reexport safe */ _dem_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsDemInfos)
/* harmony export */ });
/* harmony import */ var _dem_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dem.interfaces */ "./dist/dem/dem.interfaces.js");
/* harmony import */ var _dem_infos__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./dem.infos */ "./dist/dem/dem.infos.js");
/* harmony import */ var _dem_tileclient__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./dem.tileclient */ "./dist/dem/dem.tileclient.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/events/events.args.js":
/*!************************************!*\
  !*** ./dist/events/events.args.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EventArgs: () => (/* binding */ EventArgs),
/* harmony export */   PropertyChangedEventArgs: () => (/* binding */ PropertyChangedEventArgs)
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
    constructor(source, oldValue, newValue, propertyName) {
        super(source);
        this._propertyName = propertyName;
        this._oldValue = oldValue;
        this._newValue = newValue;
    }
    get propertyName() {
        return this._propertyName;
    }
    get oldValue() {
        return this._oldValue;
    }
    get newValue() {
        return this._newValue;
    }
    get source() {
        return this._source;
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
/* harmony export */   EventEmitter: () => (/* binding */ EventEmitter)
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
/* harmony export */   EventState: () => (/* binding */ EventState),
/* harmony export */   Observable: () => (/* binding */ Observable),
/* harmony export */   Observer: () => (/* binding */ Observer)
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
    disconnect() {
        this.source?.remove(this);
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
/* harmony export */   EventArgs: () => (/* reexport safe */ _events_args__WEBPACK_IMPORTED_MODULE_2__.EventArgs),
/* harmony export */   EventEmitter: () => (/* reexport safe */ _events_emitter__WEBPACK_IMPORTED_MODULE_0__.EventEmitter),
/* harmony export */   EventState: () => (/* reexport safe */ _events_observable__WEBPACK_IMPORTED_MODULE_1__.EventState),
/* harmony export */   Observable: () => (/* reexport safe */ _events_observable__WEBPACK_IMPORTED_MODULE_1__.Observable),
/* harmony export */   Observer: () => (/* reexport safe */ _events_observable__WEBPACK_IMPORTED_MODULE_1__.Observer),
/* harmony export */   PropertyChangedEventArgs: () => (/* reexport safe */ _events_args__WEBPACK_IMPORTED_MODULE_2__.PropertyChangedEventArgs)
/* harmony export */ });
/* harmony import */ var _events_emitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./events.emitter */ "./dist/events/events.emitter.js");
/* harmony import */ var _events_observable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./events.observable */ "./dist/events/events.observable.js");
/* harmony import */ var _events_args__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./events.args */ "./dist/events/events.args.js");




//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geodesy/calculators/geodesy.calculator.flat.js":
/*!*************************************************************!*\
  !*** ./dist/geodesy/calculators/geodesy.calculator.flat.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PythagoreanFlatEarthCalculator: () => (/* binding */ PythagoreanFlatEarthCalculator)
/* harmony export */ });
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../geography */ "./dist/geography/geography.position.js");
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../math */ "./dist/math/math.js");
/* harmony import */ var _geodesy_calculators__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geodesy.calculators */ "./dist/geodesy/geodesy.calculators.js");



class PythagoreanFlatEarthCalculator extends _geodesy_calculators__WEBPACK_IMPORTED_MODULE_0__.CalculatorBase {
    constructor(e) {
        super(e);
    }
    getDistanceFromFloat(lata, lona, latb, lonb) {
        if (lata === latb && lona === lonb) {
            return 0;
        }
        const a = Math.PI / 2 - lata * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const b = Math.PI / 2 - latb * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((lona - lonb) * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD));
        let distance = this._ellipsoid.semiMajorAxis * c;
        return distance;
    }
    getAzimuthFromFloat(lat1, lon1, lat2, lon2) {
        if (lat1 === lat2 && lon1 === lon2) {
            return 0;
        }
        lat1 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lon1 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lat2 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lon2 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const dLon = lon2 - lon1;
        const dLat = lat2 - lat1;
        let azimuth = Math.atan2(dLon, dLat) * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.RAD2DEG;
        if (azimuth < 0) {
            azimuth += 360;
        }
        return azimuth;
    }
    getLocationAtDistanceAzimuth(lat1, lon1, dist, az) {
        const unit2deg = 1 / (((2 * Math.PI) / 360) * this._ellipsoid.semiMajorAxis);
        az *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lat1;
        let newLat = lat1 + dist * Math.cos(az) * unit2deg;
        let newLon = lon1 + (dist * Math.sin(az) * unit2deg) / Math.cos(lat1 * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD);
        return new _geography__WEBPACK_IMPORTED_MODULE_2__.Geo2(newLat, newLon);
    }
}
PythagoreanFlatEarthCalculator.Shared = new PythagoreanFlatEarthCalculator();
//# sourceMappingURL=geodesy.calculator.flat.js.map

/***/ }),

/***/ "./dist/geodesy/calculators/geodesy.calculator.spherical.js":
/*!******************************************************************!*\
  !*** ./dist/geodesy/calculators/geodesy.calculator.spherical.js ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SphericalCalculator: () => (/* binding */ SphericalCalculator)
/* harmony export */ });
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../geography */ "./dist/geography/geography.position.js");
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../math */ "./dist/math/math.js");
/* harmony import */ var _geodesy_calculators__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geodesy.calculators */ "./dist/geodesy/geodesy.calculators.js");



class SphericalCalculator extends _geodesy_calculators__WEBPACK_IMPORTED_MODULE_0__.CalculatorBase {
    constructor(e) {
        super(e);
    }
    getDistanceFromFloat(lata, lona, latb, lonb, alta, altb) {
        if (lata === latb && lona === lonb && alta === altb) {
            return 0;
        }
        lata *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lona *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        latb *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lonb *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const dLat = (latb - lata) / 2;
        const dLon = (lonb - lona) / 2;
        const sdLat = Math.sin(dLat);
        const sdlon = Math.sin(dLon);
        const a = sdLat * sdLat + Math.cos(lata) * Math.cos(latb) * sdlon * sdlon;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        let distance = this._ellipsoid.semiMajorAxis * c;
        if (alta !== undefined && altb !== undefined) {
            const altDifference = altb - alta;
            distance = Math.sqrt(distance * distance + altDifference * altDifference);
        }
        return distance;
    }
    getAzimuthFromFloat(lat1, lon1, lat2, lon2) {
        if (lat1 === lat2 && lon1 === lon2) {
            return 0;
        }
        lat1 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lon1 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lat2 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lon2 *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const dlon = lon2 - lon1;
        const coslat2 = Math.cos(lat2);
        const y = Math.sin(dlon) * coslat2;
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * coslat2 * Math.cos(dlon);
        return Math.atan2(y, x) * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.RAD2DEG;
    }
    getLocationAtDistanceAzimuth(lat, lon, dist, az) {
        if (dist == 0) {
            return new _geography__WEBPACK_IMPORTED_MODULE_2__.Geo2(lat, lon);
        }
        lat *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        lon *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        az *= _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
        const ddr = dist / this._ellipsoid.semiMajorAxis;
        const cosddr = Math.cos(ddr);
        const sinddr = Math.sin(ddr);
        const coslat = Math.cos(lat);
        const sinlat = Math.sin(lat);
        const coslatsinddr = coslat * sinddr;
        const lat1 = Math.asin(sinlat * cosddr + coslatsinddr * Math.cos(az));
        const lon1 = lon + Math.atan2(coslatsinddr * Math.sin(az), cosddr - sinlat * Math.sin(lat1));
        return new _geography__WEBPACK_IMPORTED_MODULE_2__.Geo2(lat1 * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.RAD2DEG, lon1 * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.RAD2DEG);
    }
}
SphericalCalculator.Shared = new SphericalCalculator();
//# sourceMappingURL=geodesy.calculator.spherical.js.map

/***/ }),

/***/ "./dist/geodesy/calculators/index.js":
/*!*******************************************!*\
  !*** ./dist/geodesy/calculators/index.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PythagoreanFlatEarthCalculator: () => (/* reexport safe */ _geodesy_calculator_flat__WEBPACK_IMPORTED_MODULE_0__.PythagoreanFlatEarthCalculator),
/* harmony export */   SphericalCalculator: () => (/* reexport safe */ _geodesy_calculator_spherical__WEBPACK_IMPORTED_MODULE_1__.SphericalCalculator)
/* harmony export */ });
/* harmony import */ var _geodesy_calculator_flat__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geodesy.calculator.flat */ "./dist/geodesy/calculators/geodesy.calculator.flat.js");
/* harmony import */ var _geodesy_calculator_spherical__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geodesy.calculator.spherical */ "./dist/geodesy/calculators/geodesy.calculator.spherical.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geodesy/geodesy.calculators.js":
/*!*********************************************!*\
  !*** ./dist/geodesy/geodesy.calculators.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CalculatorBase: () => (/* binding */ CalculatorBase)
/* harmony export */ });
/* harmony import */ var _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geodesy.ellipsoid */ "./dist/geodesy/geodesy.ellipsoid.js");

class CalculatorBase {
    constructor(e) {
        this._ellipsoid = e ?? _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.WGS84;
    }
    get ellipsoid() {
        return this._ellipsoid;
    }
}
CalculatorBase.Shared = null;
//# sourceMappingURL=geodesy.calculators.js.map

/***/ }),

/***/ "./dist/geodesy/geodesy.ellipsoid.js":
/*!*******************************************!*\
  !*** ./dist/geodesy/geodesy.ellipsoid.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Ellipsoid: () => (/* binding */ Ellipsoid)
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
/* harmony export */   CartesianMode: () => (/* binding */ CartesianMode),
/* harmony export */   GeodeticSystem: () => (/* binding */ GeodeticSystem)
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
GeodeticSystem.Default = new GeodeticSystem(_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid.WGS84);
//# sourceMappingURL=geodesy.system.js.map

/***/ }),

/***/ "./dist/geodesy/index.js":
/*!*******************************!*\
  !*** ./dist/geodesy/index.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CalculatorBase: () => (/* reexport safe */ _geodesy_calculators__WEBPACK_IMPORTED_MODULE_2__.CalculatorBase),
/* harmony export */   CartesianMode: () => (/* reexport safe */ _geodesy_system__WEBPACK_IMPORTED_MODULE_1__.CartesianMode),
/* harmony export */   Ellipsoid: () => (/* reexport safe */ _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__.Ellipsoid),
/* harmony export */   GeodeticSystem: () => (/* reexport safe */ _geodesy_system__WEBPACK_IMPORTED_MODULE_1__.GeodeticSystem),
/* harmony export */   PythagoreanFlatEarthCalculator: () => (/* reexport safe */ _calculators__WEBPACK_IMPORTED_MODULE_3__.PythagoreanFlatEarthCalculator),
/* harmony export */   SphericalCalculator: () => (/* reexport safe */ _calculators__WEBPACK_IMPORTED_MODULE_3__.SphericalCalculator)
/* harmony export */ });
/* harmony import */ var _geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geodesy.ellipsoid */ "./dist/geodesy/geodesy.ellipsoid.js");
/* harmony import */ var _geodesy_system__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geodesy.system */ "./dist/geodesy/geodesy.system.js");
/* harmony import */ var _geodesy_calculators__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geodesy.calculators */ "./dist/geodesy/geodesy.calculators.js");
/* harmony import */ var _calculators__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./calculators */ "./dist/geodesy/calculators/index.js");





//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geography/geography.bearing.js":
/*!*********************************************!*\
  !*** ./dist/geography/geography.bearing.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Bearing: () => (/* binding */ Bearing)
/* harmony export */ });
class Bearing {
    static Zero() {
        return new Bearing(0);
    }
    static ClampAzimuth(a) {
        return ((a % 360) + 360) % 360;
    }
    constructor(value) {
        this._value = Bearing.ClampAzimuth(value);
        const rad = (this._value * Math.PI) / 180;
        this._cos = Math.cos(rad);
        this._sin = Math.sin(rad);
    }
    get value() {
        return this._value;
    }
    get radian() {
        return (this._value * Math.PI) / 180;
    }
    set value(v) {
        const clamped = Bearing.ClampAzimuth(v);
        if (this._value !== clamped) {
            this._value = clamped;
            const rad = (this._value * Math.PI) / 180;
            this._cos = Math.cos(rad);
            this._sin = Math.sin(rad);
        }
    }
    get cos() {
        return this._cos;
    }
    get sin() {
        return this._sin;
    }
    additiveInverse() {
        return new Bearing(-this._value);
    }
    copyInPlace(other) {
        this._value = other._value;
        this._cos = other._cos;
        this._sin = other._sin;
    }
    toString() {
        return `${this._value}°`;
    }
}
//# sourceMappingURL=geography.bearing.js.map

/***/ }),

/***/ "./dist/geography/geography.envelope.collection.js":
/*!*********************************************************!*\
  !*** ./dist/geography/geography.envelope.collection.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoBoundedCollection: () => (/* binding */ GeoBoundedCollection)
/* harmony export */ });
/* harmony import */ var _geography_envelope__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.envelope */ "./dist/geography/geography.envelope.js");

class GeoBoundedCollection extends _geography_envelope__WEBPACK_IMPORTED_MODULE_0__.GeoBounded {
    constructor() {
        super();
        this._items = new Array();
    }
    push(...views) {
        this._items.push(...views);
        this.invalidateEnvelope();
    }
    findIndex(predicate, thisArg) {
        return this._items.findIndex(predicate, thisArg);
    }
    splice(start, deleteCount) {
        this._items.splice(start, deleteCount);
        this.invalidateEnvelope();
    }
    [Symbol.iterator]() {
        let pointer = 0;
        let items = this._items;
        const iterator = {
            next() {
                if (pointer < items.length) {
                    return {
                        done: false,
                        value: items[pointer++],
                    };
                }
                return {
                    done: true,
                    value: null,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }
    _buildEnvelope() {
        return _geography_envelope__WEBPACK_IMPORTED_MODULE_0__.Envelope.FromEnvelopes(...this._items.map((v) => v.geoBounds));
    }
}
//# sourceMappingURL=geography.envelope.collection.js.map

/***/ }),

/***/ "./dist/geography/geography.envelope.js":
/*!**********************************************!*\
  !*** ./dist/geography/geography.envelope.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Envelope: () => (/* binding */ Envelope),
/* harmony export */   GeoBounded: () => (/* binding */ GeoBounded)
/* harmony export */ });
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../math/math */ "./dist/math/math.js");
/* harmony import */ var _geography_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.interfaces */ "./dist/geography/geography.interfaces.js");
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry/geometry.size */ "./dist/geometry/geometry.size.js");




class Envelope {
    static Zero() {
        return new Envelope(_geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3.Zero(), _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3.Zero());
    }
    static Split2(a) {
        if (a) {
            if ((0,_geography_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsGeoBounded)(a)) {
                return Envelope.Split2(a.geoBounds);
            }
            const center = a.center;
            return [
                new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, a.west), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.north, center.lon)),
                new Envelope(center, new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.north, a.east)),
                new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.south, a.west), center),
                new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.south, center.lon), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, a.east)),
            ];
        }
        return [];
    }
    static Split3(a) {
        if (a) {
            if ((0,_geography_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsGeoBounded)(a)) {
                return Envelope.Split3(a.geoBounds);
            }
            if (a.hasAltitude) {
                const center = a.center;
                return [
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, a.west, a.bottom), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.north, center.lon, center.alt)),
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, center.lon, a.bottom), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.north, a.east, center.alt)),
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.south, a.west, a.bottom), center),
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.south, center.lon, a.bottom), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, a.east, center.alt)),
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, a.west, center.alt), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.north, center.lon, a.top)),
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, center.lon, center.alt), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.north, a.east, a.top)),
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.south, a.west, center.alt), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, center.lon, a.top)),
                    new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(a.south, center.lon, center.alt), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(center.lat, a.east, a.top)),
                ];
            }
        }
        return [];
    }
    static FromPoints(...array) {
        const a = array[0];
        const hasAlt = a.alt !== undefined && a.alt !== undefined;
        const lat0 = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(a.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon0 = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(a.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt0 = hasAlt ? a.alt : undefined;
        const env = new Envelope(new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(lat0, lon0, alt0), new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(lat0, lon0, alt0));
        for (let i = 1; i < array.length; i++) {
            env.addInPlace(array[i]);
        }
        return env;
    }
    static FromEnvelopes(...array) {
        let env = undefined;
        for (let i = 0; i < array.length; i++) {
            let a = array[i];
            if (a) {
                if ((0,_geography_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsEnvelope)(a)) {
                    env = env ? env.unionInPlace(a) : a.clone();
                }
                else {
                    a = a.geoBounds;
                    if (a) {
                        env = env ? env.unionInPlace(a) : a.clone();
                    }
                }
            }
        }
        return env;
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
        return new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(this.north, this.west);
    }
    get sw() {
        return new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(this.south, this.west);
    }
    get ne() {
        return new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(this.north, this.east);
    }
    get se() {
        return new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(this.south, this.east);
    }
    equals(other) {
        return (other !== undefined &&
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
        const lon = this._min.lon + (this._max.lon - this._min.lon) / 2;
        const lat = this._min.lat + (this._max.lat - this._min.lat) / 2;
        const alt = this.hasAltitude ? this._min.alt + (this._max.alt - this._min.alt) / 2 : undefined;
        return new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo3(lat, lon, alt);
    }
    get size() {
        const w = this._max.lon - this._min.lon;
        const h = this._max.lat - this._min.lat;
        const t = this.hasAltitude ? this._max.alt - this._min.alt : 0;
        return new _geometry_geometry_size__WEBPACK_IMPORTED_MODULE_3__.Size3(w, h, t);
    }
    add(lat, lon, alt) {
        return this.clone().addInPlace(lat, lon, alt);
    }
    addInPlace(lat, lon, alt) {
        if ((0,_geography_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsLocation)(lat)) {
            return this.addInPlace(lat.lat, lat.lon, lat.alt);
        }
        this._min.lat = Math.min(this._min.lat, lat);
        this._max.lat = Math.max(this._max.lat, lat);
        if (lon !== undefined) {
            this._min.lon = Math.min(this._min.lon, lon);
            this._max.lon = Math.max(this._max.lon, lon);
        }
        if (this.hasAltitude && alt) {
            this._min.alt = Math.min(this._min.alt, alt);
            this._max.alt = Math.max(this._max.alt, alt);
        }
        return this;
    }
    unionInPlace(other) {
        this._min.lat = Math.min(this._min.lat, other.south);
        this._max.lat = Math.max(this._max.lat, other.north);
        this._min.lon = Math.min(this._min.lon, other.west);
        this._max.lon = Math.max(this._max.lon, other.east);
        if (this.hasAltitude && other.hasAltitude) {
            this._min.alt = Math.min(this._min.alt, other.bottom);
            this._max.alt = Math.max(this._max.alt, other.top);
        }
        return this;
    }
    intersects(bounds) {
        if (bounds === undefined)
            return false;
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
        return loc !== undefined && this.containsFloat(loc.lat, loc.lon, loc.alt);
    }
    containsFloat(lat, lon, alt) {
        return (lat >= this._min.lat &&
            lat <= this._max.lat &&
            (lon === undefined || (lon >= this._min.lon && lon <= this._max.lon)) &&
            (alt === undefined || (this.hasAltitude && alt >= this._min.alt && alt <= this._max.alt)));
    }
    scaleInPlace(scale) {
        const size = this.size;
        size.width = (size.width * scale - size.width) / 2;
        size.height = (size.height * scale - size.height) / 2;
        size.thickness = (size.thickness * scale - size.thickness) / 2;
        this._min.lat -= size.height;
        this._min.lon -= size.width;
        if (this._min.alt) {
            this._min.alt -= size.thickness;
        }
        this._max.lat += size.height;
        this._max.lon += size.width;
        if (this._max.alt) {
            this._max.alt += size.thickness;
        }
        return this;
    }
    toString() {
        return `Envelope(${this._min.toString()}, ${this._max.toString()})`;
    }
}
Envelope.MaxLongitude = 540;
Envelope.MaxLatitude = 90;
Envelope.MinLongitude = -Envelope.MaxLongitude;
Envelope.MinLatitude = -Envelope.MaxLatitude;
class GeoBounded {
    constructor(bounds, parent) {
        if (parent) {
            this._parent = parent;
        }
        this._env = bounds;
    }
    get parent() {
        return this._parent;
    }
    get geoBounds() {
        this.validateEnvelope();
        return this._env;
    }
    validateEnvelope() {
        if (!this._env) {
            this._env = this._buildEnvelope();
        }
    }
    invalidateEnvelope() {
        if (this._env) {
            delete this._env;
            if (this._parent) {
                this._parent.invalidateEnvelope();
            }
        }
    }
}
//# sourceMappingURL=geography.envelope.js.map

/***/ }),

/***/ "./dist/geography/geography.interfaces.js":
/*!************************************************!*\
  !*** ./dist/geography/geography.interfaces.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsEnvelope: () => (/* binding */ IsEnvelope),
/* harmony export */   IsGeoBounded: () => (/* binding */ IsGeoBounded),
/* harmony export */   IsLocation: () => (/* binding */ IsLocation)
/* harmony export */ });
function IsLocation(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.lat !== undefined && b.lon !== undefined;
}
function IsEnvelope(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.nw !== undefined && b.sw !== undefined && b.ne !== undefined && b.nw !== undefined;
}
function IsGeoBounded(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return IsEnvelope(b.geoBounds);
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
/* harmony export */   KnownPlaces: () => (/* binding */ KnownPlaces)
/* harmony export */ });
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.position */ "./dist/geography/geography.position.js");

class KnownPlaces {
    static FillSelectElement(select, places, callback) {
        const unselectedOption = document.createElement("option");
        unselectedOption.value = "";
        unselectedOption.disabled = true;
        unselectedOption.selected = true;
        unselectedOption.textContent = "Select a location...";
        select.appendChild(unselectedOption);
        for (const [category, locations] of Object.entries(places)) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = category;
            const entries = Object.entries(locations);
            const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0]));
            for (const [name, coords] of sortedEntries) {
                const option = document.createElement("option");
                option.value = _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2.ToString(coords);
                option.text = name;
                optgroup.appendChild(option);
            }
            select.appendChild(optgroup);
        }
        select.onchange = () => {
            const selectedOption = select.options[select.selectedIndex];
            const coords = _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2.Parse(selectedOption.value);
            callback(selectedOption.text, coords);
        };
        return select;
    }
}
KnownPlaces.Mountains = {
    Everest: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(27.9881, 86.925),
    K2: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(35.8808, 76.5155),
    Kangchenjunga: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(27.7025, 88.1475),
    Lhotse: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(27.9617, 86.9333),
    Makalu: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(27.8897, 87.0889),
    ChoOyu: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(28.0942, 86.6608),
    Dhaulagiri: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(28.6967, 83.4872),
    Manaslu: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(28.5494, 84.5599),
    NangaParbat: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(35.237, 74.5892),
    Annapurna: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(28.5961, 83.8203),
    Matterhorn: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(45.9763, 7.6586),
    MontBlanc: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(45.8326, 6.8652),
    Denali: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(63.0695, -151.0074),
    Aconcagua: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-32.6532, -70.0109),
    Kilimanjaro: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-3.0674, 37.3556),
    Elbrus: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(43.3499, 42.4375),
    PuncakJaya: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-4.0751, 137.1889),
    Roraima: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(5.125, -60.75),
};
KnownPlaces.Volcanoes = {
    Krakatoa: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-6.102, 105.423),
    Vesuvius: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(40.821, 14.426),
    Etna: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(37.751, 14.993),
    MaunaLoa: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(19.475, -155.608),
    Kilauea: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(19.421, -155.287),
    Fuji: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(35.3606, 138.7274),
    StHelens: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(46.1912, -122.1944),
    Pinatubo: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(15.142, 120.35),
    Rainier: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(46.853, -121.76),
    Cotopaxi: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-0.679, -78.438),
    Popocatepetl: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(19.023, -98.622),
    Eyjafjallajokull: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(63.633, -19.621),
    Santorini: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(36.404, 25.396),
    Kilimanjaro: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-3.067, 37.355),
    Arenal: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(10.463, -84.703),
    Yellowstone: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(44.428, -110.588),
    Tambora: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-8.25, 118.0),
    Sakurajima: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(31.593, 130.657),
};
KnownPlaces.SightsAndParks = {
    GrandCanyon: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(36.1069, -112.1129),
    Yellowstone: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(44.428, -110.5885),
    GreatBarrierReef: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-18.2871, 147.6992),
    Yosemite: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(37.8651, -119.5383),
    Serengeti: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-2.3333, 34.8333),
    MachuPicchu: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-13.1631, -72.545),
    Banff: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(51.1784, -115.5708),
    Galapagos: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-0.9538, -90.9656),
    TorresDelPaine: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-51.1667, -73.2425),
    PlitviceLakes: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(44.8803, 15.6161),
    VictoriaFalls: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-17.9243, 25.8573),
    Santorini: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(36.3932, 25.4615),
    Petra: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(30.3285, 35.4444),
    IguazuFalls: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-25.6953, -54.4367),
    Kruger: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(-23.9884, 31.5547),
    BryceCanyon: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(37.593, -112.1871),
    CliffsOfMoher: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(52.9715, -9.4265),
    AngkorWat: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(13.4125, 103.8669),
    HaLongBay: new _geography_position__WEBPACK_IMPORTED_MODULE_0__.Geo2(20.9101, 107.1839),
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
/* harmony export */   Geo2: () => (/* binding */ Geo2),
/* harmony export */   Geo3: () => (/* binding */ Geo3)
/* harmony export */ });
class Geo2 {
    static FromGeoJson(coordinates) {
        return new Geo2(coordinates[1], coordinates[0]);
    }
    static Parse(value) {
        const parts = value.replace(/[\[\]]/g, "").split(",");
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        return new Geo2(lat, lon);
    }
    static ToString(value) {
        return `[${value.lat},${value.lon}]`;
    }
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
    toString() {
        return `[${this._lat},${this._lon}]`;
    }
}
Geo2.Default = new Geo2(46.382581, -0.308024);
class Geo3 extends Geo2 {
    static FromGeoJson(coordinates) {
        if (coordinates.length === 2) {
            return new Geo3(coordinates[1], coordinates[0]);
        }
        return new Geo3(coordinates[1], coordinates[0], coordinates[2]);
    }
    static ToString(value) {
        if (value.alt !== undefined) {
            return `[${value.lat},${value.lon},${value.alt}]`;
        }
        return `[${value.lat},${value.lon}]`;
    }
    static Parse(value) {
        const parts = value.replace(/[\[\]]/g, "").split(",");
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (parts.length > 2) {
            const alt = parseFloat(parts[2]);
            return new Geo3(lat, lon, alt);
        }
        return new Geo3(lat, lon);
    }
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
    toString() {
        return this.hasAltitude ? `(${this._lat}, ${this._lon}, ${this._alt})` : `(${this._lat}, ${this._lon})`;
    }
}
//# sourceMappingURL=geography.position.js.map

/***/ }),

/***/ "./dist/geography/geography.projections.js":
/*!*************************************************!*\
  !*** ./dist/geography/geography.projections.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Projections: () => (/* binding */ Projections)
/* harmony export */ });
/* harmony import */ var _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../geodesy/geodesy.ellipsoid */ "./dist/geodesy/geodesy.ellipsoid.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../math/math */ "./dist/math/math.js");
/* harmony import */ var _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geometry/geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");



class Projections {
    static LatLonToWebMercator(lat, lon, ellipsoid) {
        return Projections.LatLonToWebMercatorToRef(lat, lon, _geometry_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Zero(), ellipsoid);
    }
    static LatLonToWebMercatorToRef(lat, lon, ref, ellipsoid) {
        ellipsoid = ellipsoid || _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__.Ellipsoid.WGS84;
        ref.x = lon * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD * ellipsoid.semiMajorAxis;
        lat = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(lat, Projections.WebMercatorMinLatitude, Projections.WebMercatorMaxLatitude);
        let rad = lat * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD;
        ref.y = ellipsoid.semiMajorAxis * Math.log(Math.tan(_math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.PI_4 + rad / 2));
        return ref;
    }
}
Projections.WebMercatorMaxLatitude = 85.05112878;
Projections.WebMercatorMinLatitude = -Projections.WebMercatorMaxLatitude;
//# sourceMappingURL=geography.projections.js.map

/***/ }),

/***/ "./dist/geography/index.js":
/*!*********************************!*\
  !*** ./dist/geography/index.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Bearing: () => (/* reexport safe */ _geography_bearing__WEBPACK_IMPORTED_MODULE_6__.Bearing),
/* harmony export */   Envelope: () => (/* reexport safe */ _geography_envelope__WEBPACK_IMPORTED_MODULE_2__.Envelope),
/* harmony export */   Geo2: () => (/* reexport safe */ _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo2),
/* harmony export */   Geo3: () => (/* reexport safe */ _geography_position__WEBPACK_IMPORTED_MODULE_1__.Geo3),
/* harmony export */   GeoBounded: () => (/* reexport safe */ _geography_envelope__WEBPACK_IMPORTED_MODULE_2__.GeoBounded),
/* harmony export */   GeoBoundedCollection: () => (/* reexport safe */ _geography_envelope_collection__WEBPACK_IMPORTED_MODULE_3__.GeoBoundedCollection),
/* harmony export */   GeoLine: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_8__.GeoLine),
/* harmony export */   GeoPolygon: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_8__.GeoPolygon),
/* harmony export */   GeoPolyline: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_8__.GeoPolyline),
/* harmony export */   GeoShape: () => (/* reexport safe */ _shapes_geography_shape__WEBPACK_IMPORTED_MODULE_7__.GeoShape),
/* harmony export */   GeoShapeType: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_8__.GeoShapeType),
/* harmony export */   IsEnvelope: () => (/* reexport safe */ _geography_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsEnvelope),
/* harmony export */   IsGeoBounded: () => (/* reexport safe */ _geography_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsGeoBounded),
/* harmony export */   IsLocation: () => (/* reexport safe */ _geography_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsLocation),
/* harmony export */   KnownPlaces: () => (/* reexport safe */ _geography_knownPlaces__WEBPACK_IMPORTED_MODULE_4__.KnownPlaces),
/* harmony export */   Projections: () => (/* reexport safe */ _geography_projections__WEBPACK_IMPORTED_MODULE_5__.Projections),
/* harmony export */   isGeoShape: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_8__.isGeoShape)
/* harmony export */ });
/* harmony import */ var _geography_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.interfaces */ "./dist/geography/geography.interfaces.js");
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geography_envelope__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geography.envelope */ "./dist/geography/geography.envelope.js");
/* harmony import */ var _geography_envelope_collection__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geography.envelope.collection */ "./dist/geography/geography.envelope.collection.js");
/* harmony import */ var _geography_knownPlaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geography.knownPlaces */ "./dist/geography/geography.knownPlaces.js");
/* harmony import */ var _geography_projections__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./geography.projections */ "./dist/geography/geography.projections.js");
/* harmony import */ var _geography_bearing__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./geography.bearing */ "./dist/geography/geography.bearing.js");
/* harmony import */ var _shapes_geography_shape__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./shapes/geography.shape */ "./dist/geography/shapes/geography.shape.js");
/* harmony import */ var _shapes__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./shapes */ "./dist/geography/shapes/index.js");









//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geography/shapes/geography.line.js":
/*!*************************************************!*\
  !*** ./dist/geography/shapes/geography.line.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoLine: () => (/* binding */ GeoLine)
/* harmony export */ });
/* harmony import */ var _geography_envelope__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography.envelope */ "./dist/geography/geography.envelope.js");
/* harmony import */ var _geography_shape__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.shape */ "./dist/geography/shapes/geography.shape.js");
/* harmony import */ var _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.shapes.interfaces */ "./dist/geography/shapes/geography.shapes.interfaces.js");



class GeoLine extends _geography_shape__WEBPACK_IMPORTED_MODULE_0__.GeoShape {
    constructor(a, b) {
        super(_geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__.GeoShapeType.Line);
        this._alice = a;
        this._bob = b;
    }
    get start() {
        return this._alice;
    }
    set start(v) {
        if (!this._alice.equals(v)) {
            this._alice = v;
            this.invalidateEnvelope();
        }
    }
    get end() {
        return this._bob;
    }
    set end(v) {
        if (!this._bob.equals(v)) {
            this._bob = v;
            this.invalidateEnvelope();
        }
    }
    _buildEnvelope() {
        return _geography_envelope__WEBPACK_IMPORTED_MODULE_2__.Envelope.FromPoints(this._alice, this._bob);
    }
}
//# sourceMappingURL=geography.line.js.map

/***/ }),

/***/ "./dist/geography/shapes/geography.polygon.js":
/*!****************************************************!*\
  !*** ./dist/geography/shapes/geography.polygon.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoPolygon: () => (/* binding */ GeoPolygon)
/* harmony export */ });
/* harmony import */ var _geodesy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../geodesy */ "./dist/geodesy/geodesy.calculators.js");
/* harmony import */ var _geodesy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../geodesy */ "./dist/geodesy/calculators/geodesy.calculator.spherical.js");
/* harmony import */ var _geography_position__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geography.position */ "./dist/geography/geography.position.js");
/* harmony import */ var _geography_polyline__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.polyline */ "./dist/geography/shapes/geography.polyline.js");
/* harmony import */ var _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geography.shapes.interfaces */ "./dist/geography/shapes/geography.shapes.interfaces.js");




class GeoPolygon extends _geography_polyline__WEBPACK_IMPORTED_MODULE_0__.GeoPolyline {
    static FromCircle(center, radius, step, p) {
        const processor = p ?? _geodesy__WEBPACK_IMPORTED_MODULE_1__.CalculatorBase.Shared ?? _geodesy__WEBPACK_IMPORTED_MODULE_2__.SphericalCalculator.Shared;
        const points = [];
        const angle = 360 / step;
        const r = radius;
        const lat = center.lat;
        const lon = center.lon;
        for (let i = 0; i < 360; i += angle) {
            points.push(processor.getLocationAtDistanceAzimuth(lat, lon, r, i));
        }
        return new GeoPolygon(points);
    }
    static FromRectangle(center, width, height, p) {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        p = p ?? _geodesy__WEBPACK_IMPORTED_MODULE_1__.CalculatorBase.Shared ?? _geodesy__WEBPACK_IMPORTED_MODULE_2__.SphericalCalculator.Shared;
        const lat = center.lat;
        const lon = center.lon;
        const N = p.getLocationAtDistanceAzimuth(lat, lon, halfHeight, 0);
        const E = p.getLocationAtDistanceAzimuth(lat, lon, halfWidth, 90);
        const S = p.getLocationAtDistanceAzimuth(lat, lon, halfHeight, 180);
        const W = p.getLocationAtDistanceAzimuth(lat, lon, halfWidth, 270);
        return new GeoPolygon([new _geography_position__WEBPACK_IMPORTED_MODULE_3__.Geo2(N.lat, W.lon), new _geography_position__WEBPACK_IMPORTED_MODULE_3__.Geo2(N.lat, E.lon), new _geography_position__WEBPACK_IMPORTED_MODULE_3__.Geo2(S.lat, E.lon), new _geography_position__WEBPACK_IMPORTED_MODULE_3__.Geo2(S.lat, W.lon)]);
    }
    constructor(p) {
        super(p, _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_4__.GeoShapeType.Polygon);
    }
}
//# sourceMappingURL=geography.polygon.js.map

/***/ }),

/***/ "./dist/geography/shapes/geography.polyline.js":
/*!*****************************************************!*\
  !*** ./dist/geography/shapes/geography.polyline.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoPolyline: () => (/* binding */ GeoPolyline)
/* harmony export */ });
/* harmony import */ var _geography_envelope__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography.envelope */ "./dist/geography/geography.envelope.js");
/* harmony import */ var _geography_shape__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.shape */ "./dist/geography/shapes/geography.shape.js");
/* harmony import */ var _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.shapes.interfaces */ "./dist/geography/shapes/geography.shapes.interfaces.js");



class GeoPolyline extends _geography_shape__WEBPACK_IMPORTED_MODULE_0__.GeoShape {
    constructor(p, type) {
        super(type ?? _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__.GeoShapeType.Polyline);
        this._points = p;
    }
    get points() {
        return this._points;
    }
    _buildEnvelope() {
        return _geography_envelope__WEBPACK_IMPORTED_MODULE_2__.Envelope.FromPoints(...this._points);
    }
}
//# sourceMappingURL=geography.polyline.js.map

/***/ }),

/***/ "./dist/geography/shapes/geography.shape.js":
/*!**************************************************!*\
  !*** ./dist/geography/shapes/geography.shape.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoShape: () => (/* binding */ GeoShape)
/* harmony export */ });
/* harmony import */ var _geography_envelope__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geography.envelope */ "./dist/geography/geography.envelope.js");

class GeoShape extends _geography_envelope__WEBPACK_IMPORTED_MODULE_0__.GeoBounded {
    constructor(t) {
        super();
        this._type = t;
    }
    get type() {
        return this._type;
    }
}
//# sourceMappingURL=geography.shape.js.map

/***/ }),

/***/ "./dist/geography/shapes/geography.shapes.interfaces.js":
/*!**************************************************************!*\
  !*** ./dist/geography/shapes/geography.shapes.interfaces.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoShapeType: () => (/* binding */ GeoShapeType),
/* harmony export */   isGeoShape: () => (/* binding */ isGeoShape)
/* harmony export */ });
var GeoShapeType;
(function (GeoShapeType) {
    GeoShapeType[GeoShapeType["Unknown"] = 100] = "Unknown";
    GeoShapeType[GeoShapeType["Point"] = 101] = "Point";
    GeoShapeType[GeoShapeType["Line"] = 102] = "Line";
    GeoShapeType[GeoShapeType["Polyline"] = 103] = "Polyline";
    GeoShapeType[GeoShapeType["Polygon"] = 104] = "Polygon";
})(GeoShapeType || (GeoShapeType = {}));
function isGeoShape(value) {
    return value && value.type !== undefined && GeoShapeType[value.type] !== undefined;
}
//# sourceMappingURL=geography.shapes.interfaces.js.map

/***/ }),

/***/ "./dist/geography/shapes/index.js":
/*!****************************************!*\
  !*** ./dist/geography/shapes/index.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoLine: () => (/* reexport safe */ _geography_line__WEBPACK_IMPORTED_MODULE_4__.GeoLine),
/* harmony export */   GeoPolygon: () => (/* reexport safe */ _geography_polygon__WEBPACK_IMPORTED_MODULE_2__.GeoPolygon),
/* harmony export */   GeoPolyline: () => (/* reexport safe */ _geography_polyline__WEBPACK_IMPORTED_MODULE_3__.GeoPolyline),
/* harmony export */   GeoShape: () => (/* reexport safe */ _geography_shape__WEBPACK_IMPORTED_MODULE_1__.GeoShape),
/* harmony export */   GeoShapeType: () => (/* reexport safe */ _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.GeoShapeType),
/* harmony export */   isGeoShape: () => (/* reexport safe */ _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.isGeoShape)
/* harmony export */ });
/* harmony import */ var _geography_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geography.shapes.interfaces */ "./dist/geography/shapes/geography.shapes.interfaces.js");
/* harmony import */ var _geography_shape__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geography.shape */ "./dist/geography/shapes/geography.shape.js");
/* harmony import */ var _geography_polygon__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geography.polygon */ "./dist/geography/shapes/geography.polygon.js");
/* harmony import */ var _geography_polyline__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geography.polyline */ "./dist/geography/shapes/geography.polyline.js");
/* harmony import */ var _geography_line__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geography.line */ "./dist/geography/shapes/geography.line.js");





//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geometry/geometry.bounds.collection.js":
/*!*****************************************************!*\
  !*** ./dist/geometry/geometry.bounds.collection.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BoundedCollection: () => (/* binding */ BoundedCollection)
/* harmony export */ });
/* harmony import */ var _geometry_bounds__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.bounds */ "./dist/geometry/geometry.bounds.js");

class BoundedCollection extends _geometry_bounds__WEBPACK_IMPORTED_MODULE_0__.Bounded {
    constructor() {
        super();
        this._items = new Array();
    }
    push(...views) {
        this._items.push(...views);
        this.invalidateBounds();
    }
    findIndex(predicate, thisArg) {
        return this._items.findIndex(predicate, thisArg);
    }
    splice(start, deleteCount) {
        this._items.splice(start, deleteCount);
        this.invalidateBounds();
    }
    [Symbol.iterator]() {
        let pointer = 0;
        let items = this._items;
        const iterator = {
            next() {
                if (pointer < items.length) {
                    return {
                        done: false,
                        value: items[pointer++],
                    };
                }
                return {
                    done: true,
                    value: null,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }
    _buildBounds() {
        return _geometry_bounds__WEBPACK_IMPORTED_MODULE_0__.Bounds2.FromBounds(...this._items.map((v) => v.bounds));
    }
}
//# sourceMappingURL=geometry.bounds.collection.js.map

/***/ }),

/***/ "./dist/geometry/geometry.bounds.js":
/*!******************************************!*\
  !*** ./dist/geometry/geometry.bounds.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Bounded: () => (/* binding */ Bounded),
/* harmony export */   Bounds2: () => (/* binding */ Bounds2)
/* harmony export */ });
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");


class Bounds2 extends _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2 {
    static Zero() {
        return new Bounds2(0, 0, 0, 0);
    }
    static FromSize(size) {
        return new Bounds2(0, 0, size?.width || 0, size.height || 0);
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
        return new Bounds2(xmin, ymin, xmax - xmin, ymax - ymin);
    }
    static FromBounds(...array) {
        let rect = undefined;
        for (let i = 0; i < array.length; i++) {
            let a = array[i];
            if (a) {
                if ((0,_geometry_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsBounds)(a)) {
                    rect = rect ? rect.unionInPlace(a) : a.clone();
                }
                else {
                    a = a.bounds;
                    if (a) {
                        rect = rect ? rect.unionInPlace(a) : a.clone();
                    }
                }
            }
        }
        return rect;
    }
    constructor(x, y, width, height) {
        super(x, y);
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
        return new Bounds2(this.x, this.y, this.width, this.height);
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
    intersects(other) {
        if (!other || this.ymin > other.ymax || this.ymax < other.ymin || this.xmin > other.xmax || this.xmax < other.xmin) {
            return false;
        }
        return true;
    }
    intersection(other, ref) {
        if (!other || !this.intersects(other)) {
            return undefined;
        }
        const target = ref || Bounds2.Zero();
        target.y = Math.max(this.ymin, other.ymin);
        target.height = Math.min(this.ymax, other.ymax) - target.y;
        target.x = Math.max(this.xmin, other.xmin);
        target.width = Math.min(this.xmax, other.xmax) - target.x;
        return target;
    }
    unionInPlace(other) {
        if (!other)
            return this;
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
    containsBounds(other) {
        if (!other)
            return false;
        return (other.xmin >= this.xmin &&
            other.xmin <= this.xmax &&
            other.ymin >= this.ymin &&
            other.ymin <= this.ymax &&
            other.xmax >= this.xmin &&
            other.xmax <= this.xmax &&
            other.ymax >= this.ymin &&
            other.ymax <= this.ymax);
    }
    inflateInPlace(dx, dy) {
        this.x -= dx;
        this.y -= dy;
        this.width += 2 * dx;
        this.height += 2 * dy;
        return this;
    }
    toString() {
        return `left:${this.xmin}, bottom:${this.ymin}, right:${this.xmax}, top:${this.ymax}, width:${this.width}, height:${this.height}`;
    }
}
class Bounded {
    constructor(bounds, parent) {
        if (parent) {
            this._parent = parent;
        }
        this._rect = bounds;
    }
    get parent() {
        return this._parent;
    }
    get bounds() {
        this.validateBounds();
        return this._rect;
    }
    validateBounds() {
        if (!this._rect) {
            this._rect = this._buildBounds();
        }
    }
    invalidateBounds() {
        if (this._rect) {
            delete this._rect;
            if (this._parent) {
                this._parent.invalidateBounds();
            }
        }
    }
}
//# sourceMappingURL=geometry.bounds.js.map

/***/ }),

/***/ "./dist/geometry/geometry.cartesian.js":
/*!*********************************************!*\
  !*** ./dist/geometry/geometry.cartesian.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Cartesian2: () => (/* binding */ Cartesian2),
/* harmony export */   Cartesian3: () => (/* binding */ Cartesian3),
/* harmony export */   Cartesian4: () => (/* binding */ Cartesian4)
/* harmony export */ });
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../math */ "./dist/math/math.units.js");
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../math */ "./dist/math/math.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");


class Cartesian2 {
    static Flatten(values, ref) {
        ref = ref ?? new Float32Array(values.length * 2);
        let i = 0;
        for (let j = 0; j < values.length; j++) {
            ref[i++] = values[j].x;
            ref[i++] = values[j].y;
        }
        return ref;
    }
    static ComputeCode(point, clipArea) {
        let code = _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.RegionCode.INSIDE;
        if (point.x < clipArea.xmin) {
            code |= _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.RegionCode.LEFT;
        }
        else if (point.x > clipArea.xmax) {
            code |= _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.RegionCode.RIGHT;
        }
        if (point.y < clipArea.ymin) {
            code |= _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.RegionCode.BOTTOM;
        }
        else if (point.y > clipArea.ymax) {
            code |= _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.RegionCode.TOP;
        }
        return code;
    }
    static Dot(a, b) {
        return a.x * b.y - a.y * b.x;
    }
    static Cross(a, b) {
        return new Cartesian2(a.x * b.y - a.y * b.x, a.y * b.x - a.x * b.y);
    }
    static Subtract(a, b) {
        return new Cartesian2(a.x - b.x, a.y - b.y);
    }
    static ConvertInPlace(value, from, to) {
        return Cartesian2.ConvertToRef(value, from, to, value);
    }
    static ConvertToRef(value, from, to, ref) {
        ref = ref ?? Cartesian2.Zero();
        ref.x = _math__WEBPACK_IMPORTED_MODULE_1__.Quantity.Convert(value.x, from, to);
        ref.y = _math__WEBPACK_IMPORTED_MODULE_1__.Quantity.Convert(value.y, from, to);
        return ref;
    }
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
class Cartesian3 extends Cartesian2 {
    static Dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }
    static Cross(a, b) {
        return new Cartesian3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }
    static Subtract(a, b) {
        return new Cartesian3(a.x - b.x, a.y - b.y, a.z - b.z);
    }
    static Normalize(a) {
        return Cartesian3.NormalizeToRef(a, Cartesian3.Zero());
    }
    static NormalizeInPlace(a) {
        return Cartesian3.NormalizeToRef(a, a);
    }
    static Normal(v0, v1, v2) {
        return Cartesian3.NormalizeInPlace(Cartesian3.Cross(Cartesian3.Subtract(v1, v0), Cartesian3.Subtract(v2, v0)));
    }
    static NormalizeToRef(a, ref) {
        const length = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        ref.x = a.x / length;
        ref.y = a.y / length;
        ref.z = a.z / length;
        return ref;
    }
    static AreCoincident(a, b, epsilon) {
        const length = Cartesian3.Magnitude(Cartesian3.Subtract(a, b));
        return length <= (epsilon ?? _math__WEBPACK_IMPORTED_MODULE_2__.Scalar.EPSILON);
    }
    static AreCollinear(a, b, c, epsilon) {
        const length = Cartesian3.Magnitude(Cartesian3.Cross(Cartesian3.Subtract(b, a), Cartesian3.Subtract(c, a)));
        return length <= (epsilon ?? _math__WEBPACK_IMPORTED_MODULE_2__.Scalar.EPSILON);
    }
    static IsWithinTheBounds(a, b, p) {
        if (!Cartesian3.AreCollinear(a, b, p)) {
            return false;
        }
        const ab = Cartesian3.Subtract(b, a);
        const ap = Cartesian3.Subtract(p, a);
        const bp = Cartesian3.Subtract(p, b);
        if (Cartesian3.Dot(ab, ap) < 0) {
            return false;
        }
        if (Cartesian3.Dot(ab, bp) > 0) {
            return false;
        }
        return true;
    }
    static AreCoplanar(a, b, c, d, epsilon) {
        var n1 = Cartesian3.Cross(Cartesian3.Subtract(c, a), Cartesian3.Subtract(c, b));
        var n2 = Cartesian3.Cross(Cartesian3.Subtract(d, a), Cartesian3.Subtract(d, b));
        var m1 = Cartesian3.Magnitude(n1);
        var m2 = Cartesian3.Magnitude(n2);
        const EPSILON = epsilon ?? _math__WEBPACK_IMPORTED_MODULE_2__.Scalar.EPSILON;
        return (m1 <= EPSILON ||
            m2 <= EPSILON ||
            Cartesian3.AreCollinear(Cartesian3.Zero(), Cartesian3.MultplyByFloatInPlace(n1, 1.0 / m1), Cartesian3.MultplyByFloatInPlace(n2, 1.0 / m2)));
    }
    static MultplyByFloatInPlace(a, n) {
        return Cartesian3.MultplyByFloatToRef(a, n, a);
    }
    static MultplyByFloatToRef(a, n, ref) {
        ref.x = a.x * n;
        ref.y = a.y * n;
        ref.z = a.z * n;
        return ref;
    }
    static Magnitude(a) {
        return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    }
    static ConvertInPlace(value, from, to) {
        return Cartesian3.ConvertToRef(value, from, to, value);
    }
    static ConvertToRef(value, from, to, ref) {
        ref = ref ?? Cartesian3.Zero();
        ref.x = _math__WEBPACK_IMPORTED_MODULE_1__.Quantity.Convert(value.x, from, to);
        ref.y = _math__WEBPACK_IMPORTED_MODULE_1__.Quantity.Convert(value.y, from, to);
        ref.z = _math__WEBPACK_IMPORTED_MODULE_1__.Quantity.Convert(value.z, from, to);
        return ref;
    }
    static Centroid(values, ref) {
        let x = 0;
        let y = 0;
        let z = 0;
        for (let i = 0; i < values.length; i++) {
            x += values[i].x;
            y += values[i].y;
            z += values[i].z;
        }
        const count = values.length;
        ref = ref ?? Cartesian3.Zero();
        ref.x = x / count;
        ref.y = y / count;
        ref.z = z / count;
        return ref;
    }
    static Zero() {
        return new Cartesian3(0, 0, 0);
    }
    static FromArray(array, offset = 0, stride = 3) {
        let i = 0;
        const x = array[offset + i];
        const y = i < stride ? array[offset + ++i] : 0;
        const z = i < stride ? array[offset + ++i] : 0;
        return new Cartesian3(x, y, z);
    }
    static Flatten(values, ref) {
        ref = ref ?? new Float32Array(values.length * 3);
        let i = 0;
        for (let j = 0; j < values.length; j++) {
            ref[i++] = values[j].x;
            ref[i++] = values[j].y;
            ref[i++] = values[j].z;
        }
        return ref;
    }
    static Equals(a, b, epsilon) {
        epsilon = epsilon ?? _math__WEBPACK_IMPORTED_MODULE_2__.Scalar.EPSILON;
        return _math__WEBPACK_IMPORTED_MODULE_2__.Scalar.WithinEpsilon(a.x, b.x, epsilon) && _math__WEBPACK_IMPORTED_MODULE_2__.Scalar.WithinEpsilon(a.y, b.y, epsilon) && _math__WEBPACK_IMPORTED_MODULE_2__.Scalar.WithinEpsilon(a.z, b.z, epsilon);
    }
    constructor(x, y, z = 0.0) {
        super(x, y);
        this.z = z;
    }
    toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}`;
    }
}
class Cartesian4 extends Cartesian3 {
    static Zero() {
        return new Cartesian4(0, 0, 0);
    }
    constructor(x, y, z, w = 1.0) {
        super(x, y, z);
        this.w = w;
    }
    toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}, w:${this.w}`;
    }
}
//# sourceMappingURL=geometry.cartesian.js.map

/***/ }),

/***/ "./dist/geometry/geometry.convex.quickhull.js":
/*!****************************************************!*\
  !*** ./dist/geometry/geometry.convex.quickhull.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QuickHull: () => (/* binding */ QuickHull)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils */ "./dist/utils/runtime.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");


class Face {
    constructor(v0, v1, v2, o0, o1, o2, normal) {
        this.Vertex0 = v0;
        this.Vertex1 = v1;
        this.Vertex2 = v2;
        this.Opposite0 = o0;
        this.Opposite1 = o1;
        this.Opposite2 = o2;
        this.Normal = normal;
    }
    Equals(other) {
        return (this.Vertex0 == other.Vertex0 &&
            this.Vertex1 == other.Vertex1 &&
            this.Vertex2 == other.Vertex2 &&
            this.Opposite0 == other.Opposite0 &&
            this.Opposite1 == other.Opposite1 &&
            this.Opposite2 == other.Opposite2 &&
            this.Normal == other.Normal);
    }
}
class PointFace {
    constructor(p, f, d) {
        this.Point = p;
        this.Face = f;
        this.Distance = d;
    }
}
class HorizonEdge {
    constructor(Face = 0, Edge0 = 0, Edge1 = 0) {
        this.Face = Face;
        this.Edge0 = Edge0;
        this.Edge1 = Edge1;
    }
}
class QuickHull {
    constructor() {
        this.openSetTail = -1;
        this.faceCount = 0;
        this.faces = new Map();
        this.litFaces = new Set();
        this.horizon = new Array();
        this.openSet = new Array();
        this.hullVerts = new Map();
    }
    generateHull(points, splitVerts = false) {
        if (points.length < 4) {
            throw new Error("Need at least 4 points to generate a convex hull");
        }
        this._initialize(points, splitVerts);
        this._generateInitialHull(points);
        while (this.openSetTail >= 0) {
            this._growHull(points);
        }
        const exported = this._exportMeshData(points, splitVerts);
        return exported;
    }
    _initialize(points, splitVerts) {
        this.faceCount = 0;
        this.openSetTail = -1;
        this.faces.clear();
        this.litFaces?.clear();
        this.horizon = [];
        this.openSet = [];
        if (!splitVerts) {
            this.hullVerts.clear();
        }
    }
    _generateInitialHull(points) {
        const b = this._findInitialHullIndices(points);
        const b0 = b[0];
        const b1 = b[1];
        const b2 = b[2];
        const b3 = b[3];
        var v0 = points[b0];
        var v1 = points[b1];
        var v2 = points[b2];
        var v3 = points[b3];
        var above = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Dot(_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Subtract(v3, v1), _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Cross(_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Subtract(v1, v0), _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Subtract(v2, v0))) > 0.0;
        this.faceCount = 0;
        if (above) {
            this.faces.set(this.faceCount++, new Face(b0, b2, b1, 3, 1, 2, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b0], points[b2], points[b1])));
            this.faces.set(this.faceCount++, new Face(b0, b1, b3, 3, 2, 0, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b0], points[b1], points[b3])));
            this.faces.set(this.faceCount++, new Face(b0, b3, b2, 3, 0, 1, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b0], points[b3], points[b2])));
            this.faces.set(this.faceCount++, new Face(b1, b2, b3, 2, 1, 0, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b1], points[b2], points[b3])));
        }
        else {
            this.faces.set(this.faceCount++, new Face(b0, b1, b2, 3, 2, 1, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b0], points[b1], points[b2])));
            this.faces.set(this.faceCount++, new Face(b0, b3, b1, 3, 0, 2, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b0], points[b3], points[b1])));
            this.faces.set(this.faceCount++, new Face(b0, b2, b3, 3, 1, 0, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b0], points[b2], points[b3])));
            this.faces.set(this.faceCount++, new Face(b1, b3, b2, 2, 0, 1, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[b1], points[b3], points[b2])));
        }
        this._verifyFaces(points);
        for (let i = 0; i < points.length; i++) {
            if (i == b0 || i == b1 || i == b2 || i == b3)
                continue;
            this.openSet.push(new PointFace(i, QuickHull.UNASSIGNED, 0.0));
        }
        this.openSet.push(new PointFace(b0, QuickHull.INSIDE, Number.NaN));
        this.openSet.push(new PointFace(b1, QuickHull.INSIDE, Number.NaN));
        this.openSet.push(new PointFace(b2, QuickHull.INSIDE, Number.NaN));
        this.openSet.push(new PointFace(b3, QuickHull.INSIDE, Number.NaN));
        this.openSetTail = this.openSet.length - 5;
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet.length == points.length);
        for (let i = 0; i <= this.openSetTail; i++) {
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet[i].Face == QuickHull.UNASSIGNED);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet[this.openSetTail].Face == QuickHull.UNASSIGNED);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet[this.openSetTail + 1].Face == QuickHull.INSIDE);
            var assigned = false;
            var fp = this.openSet[i];
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.size == 4);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.size == this.faceCount);
            for (let j = 0; j < 4; j++) {
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.has(j));
                var face = this.faces.get(j);
                var dist = this._pointFaceDistance(points[fp.Point], points[face.Vertex0], face);
                if (dist > 0) {
                    fp.Face = j;
                    fp.Distance = dist;
                    this.openSet[i] = fp;
                    assigned = true;
                    break;
                }
            }
            if (!assigned) {
                fp.Face = QuickHull.INSIDE;
                fp.Distance = Number.NaN;
                this.openSet[i] = this.openSet[this.openSetTail];
                this.openSet[this.openSetTail] = fp;
                this.openSetTail -= 1;
                i -= 1;
            }
        }
        this._verifyOpenSet(points);
    }
    _findInitialHullIndices(points) {
        var count = points.length;
        for (let i0 = 0; i0 < count - 3; i0++) {
            for (let i1 = i0 + 1; i1 < count - 2; i1++) {
                var p0 = points[i0];
                var p1 = points[i1];
                if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.AreCoincident(p0, p1, QuickHull.EPSILON))
                    continue;
                for (let i2 = i1 + 1; i2 < count - 1; i2++) {
                    var p2 = points[i2];
                    if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.AreCollinear(p0, p1, p2, QuickHull.EPSILON))
                        continue;
                    for (let i3 = i2 + 1; i3 < count - 0; i3++) {
                        var p3 = points[i3];
                        if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.AreCoplanar(p0, p1, p2, p3, QuickHull.EPSILON))
                            continue;
                        return [i0, i1, i2, i3];
                    }
                }
            }
        }
        throw new Error("Can't generate hull, points are coplanar");
    }
    _growHull(points) {
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSetTail >= 0);
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet[0].Face != QuickHull.INSIDE);
        var farthestPoint = 0;
        var dist = this.openSet[0].Distance;
        for (let i = 1; i <= this.openSetTail; i++) {
            if (this.openSet[i].Distance > dist) {
                farthestPoint = i;
                dist = this.openSet[i].Distance;
            }
        }
        this._findHorizon(points, points[this.openSet[farthestPoint].Point], this.openSet[farthestPoint].Face, this.faces.get(this.openSet[farthestPoint].Face));
        this._verifyHorizon();
        this._constructCone(points, this.openSet[farthestPoint].Point);
        this._verifyFaces(points);
        this._reassignPoints(points);
    }
    _findHorizon(points, point, fi, face) {
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(face != null && face != undefined);
        this.litFaces.clear();
        this.horizon = [];
        this.litFaces.add(fi);
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this._pointFaceDistance(point, points[face.Vertex0], face) > 0.0);
        {
            var oppositeFace = this.faces.get(face.Opposite0);
            var dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);
            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(face.Opposite0, face.Vertex1, face.Vertex2));
            }
            else {
                this._searchHorizon(points, point, fi, face.Opposite0, oppositeFace);
            }
        }
        if (!this.litFaces.has(face.Opposite1)) {
            var oppositeFace = this.faces.get(face.Opposite1);
            var dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);
            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(face.Opposite1, face.Vertex2, face.Vertex0));
            }
            else {
                this._searchHorizon(points, point, fi, face.Opposite1, oppositeFace);
            }
        }
        if (!this.litFaces.has(face.Opposite2)) {
            var oppositeFace = this.faces.get(face.Opposite2);
            var dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);
            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(face.Opposite2, face.Vertex0, face.Vertex1));
            }
            else {
                this._searchHorizon(points, point, fi, face.Opposite2, oppositeFace);
            }
        }
    }
    _searchHorizon(points, point, prevFaceIndex, faceCount, face) {
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(prevFaceIndex >= 0);
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.litFaces.has(prevFaceIndex));
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(!this.litFaces.has(faceCount));
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.get(faceCount)?.Equals(face));
        this.litFaces.add(faceCount);
        let nextFaceIndex0;
        let nextFaceIndex1;
        let edge0;
        let edge1;
        let edge2;
        if (prevFaceIndex == face.Opposite0) {
            nextFaceIndex0 = face.Opposite1;
            nextFaceIndex1 = face.Opposite2;
            edge0 = face.Vertex2;
            edge1 = face.Vertex0;
            edge2 = face.Vertex1;
        }
        else if (prevFaceIndex == face.Opposite1) {
            nextFaceIndex0 = face.Opposite2;
            nextFaceIndex1 = face.Opposite0;
            edge0 = face.Vertex0;
            edge1 = face.Vertex1;
            edge2 = face.Vertex2;
        }
        else {
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(prevFaceIndex == face.Opposite2);
            nextFaceIndex0 = face.Opposite0;
            nextFaceIndex1 = face.Opposite1;
            edge0 = face.Vertex1;
            edge1 = face.Vertex2;
            edge2 = face.Vertex0;
        }
        if (!this.litFaces.has(nextFaceIndex0)) {
            const oppositeFace = this.faces.get(nextFaceIndex0);
            const dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);
            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(nextFaceIndex0, edge0, edge1));
            }
            else {
                this._searchHorizon(points, point, faceCount, nextFaceIndex0, oppositeFace);
            }
        }
        if (!this.litFaces.has(nextFaceIndex1)) {
            const oppositeFace = this.faces.get(nextFaceIndex1);
            const dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);
            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(nextFaceIndex1, edge1, edge2));
            }
            else {
                this._searchHorizon(points, point, faceCount, nextFaceIndex1, oppositeFace);
            }
        }
    }
    _constructCone(points, farthestPoint) {
        for (let fi of this.litFaces) {
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.has(fi));
            this.faces.delete(fi);
        }
        const firstNewFace = this.faceCount;
        for (let i = 0; i < this.horizon.length; i++) {
            const v0 = farthestPoint;
            const v1 = this.horizon[i].Edge0;
            const v2 = this.horizon[i].Edge1;
            const o0 = this.horizon[i].Face;
            const o1 = i == this.horizon.length - 1 ? firstNewFace : firstNewFace + i + 1;
            const o2 = i == 0 ? firstNewFace + this.horizon.length - 1 : firstNewFace + i - 1;
            let fi = this.faceCount++;
            this.faces.set(fi, new Face(v0, v1, v2, o0, o1, o2, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[v0], points[v1], points[v2])));
            var horizonFace = this.faces.get(this.horizon[i].Face);
            if (horizonFace.Vertex0 == v1) {
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(v2 == horizonFace.Vertex2);
                horizonFace.Opposite1 = fi;
            }
            else if (horizonFace.Vertex1 == v1) {
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(v2 == horizonFace.Vertex0);
                horizonFace.Opposite2 = fi;
            }
            else {
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(v1 == horizonFace.Vertex2);
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(v2 == horizonFace.Vertex1);
                horizonFace.Opposite0 = fi;
            }
            this.faces.set(this.horizon[i].Face, horizonFace);
        }
    }
    _reassignPoints(points) {
        for (let i = 0; i <= this.openSetTail; i++) {
            var fp = this.openSet[i];
            if (this.litFaces.has(fp.Face)) {
                var assigned = false;
                var point = points[fp.Point];
                for (let [fi, face] of this.faces) {
                    var dist = this._pointFaceDistance(point, points[face.Vertex0], face);
                    if (dist > QuickHull.EPSILON) {
                        assigned = true;
                        fp.Face = fi;
                        fp.Distance = dist;
                        this.openSet[i] = fp;
                        break;
                    }
                }
                if (!assigned) {
                    fp.Face = QuickHull.INSIDE;
                    fp.Distance = Number.NaN;
                    this.openSet[i] = this.openSet[this.openSetTail];
                    this.openSet[this.openSetTail] = fp;
                    i--;
                    this.openSetTail--;
                }
            }
        }
    }
    _exportMeshData(points, splitVerts) {
        const verts = new Array();
        const tris = new Array();
        const normals = new Array();
        for (let face of this.faces.values()) {
            let vi0 = 0, vi1 = 0, vi2 = 0;
            if (splitVerts) {
                vi0 = verts.length;
                verts.push(points[face.Vertex0]);
                vi1 = verts.length;
                verts.push(points[face.Vertex1]);
                vi2 = verts.length;
                verts.push(points[face.Vertex2]);
                normals.push(face.Normal);
                normals.push(face.Normal);
                normals.push(face.Normal);
            }
            else {
                let tmp = this.hullVerts.get(face.Vertex0);
                if (!tmp) {
                    vi0 = verts.length;
                    this.hullVerts.set(face.Vertex0, vi0);
                    verts.push(points[face.Vertex0]);
                }
                else {
                    vi0 = tmp;
                }
                tmp = this.hullVerts.get(face.Vertex1);
                if (!tmp) {
                    vi1 = verts.length;
                    this.hullVerts.set(face.Vertex1, vi1);
                    verts.push(points[face.Vertex1]);
                }
                else {
                    vi1 = tmp;
                }
                tmp = this.hullVerts.get(face.Vertex2);
                if (!tmp) {
                    vi2 = verts.length;
                    this.hullVerts.set(face.Vertex2, vi2);
                    verts.push(points[face.Vertex2]);
                }
                else {
                    vi2 = tmp;
                }
            }
            tris.push(vi0);
            tris.push(vi1);
            tris.push(vi2);
        }
        return { vertices: verts, faces: tris, normals: normals };
    }
    _pointFaceDistance(point, pointOnFace, face) {
        return _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Dot(face.Normal, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Subtract(point, pointOnFace));
    }
    _verifyOpenSet(points) {
        for (let i = 0; i < this.openSet.length; i++) {
            if (i > this.openSetTail) {
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet[i].Face == QuickHull.INSIDE);
            }
            else {
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet[i].Face != QuickHull.INSIDE);
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.openSet[i].Face != QuickHull.UNASSIGNED);
                (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this._pointFaceDistance(points[this.openSet[i].Point], points[this.faces.get(this.openSet[i].Face).Vertex0], this.faces.get(this.openSet[i].Face)) > 0.0);
            }
        }
    }
    _verifyHorizon() {
        for (let i = 0; i < this.horizon.length; i++) {
            const prev = i == 0 ? this.horizon.length - 1 : i - 1;
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.horizon[prev].Edge1 == this.horizon[i].Edge0);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this._hasEdge(this.faces.get(this.horizon[i].Face), this.horizon[i].Edge1, this.horizon[i].Edge0));
        }
    }
    _verifyFaces(points) {
        for (var [fi, face] of this.faces) {
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.has(face.Opposite0));
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.has(face.Opposite1));
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this.faces.has(face.Opposite2));
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(face.Opposite0 != fi);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(face.Opposite1 != fi);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(face.Opposite2 != fi);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(face.Vertex0 != face.Vertex1);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(face.Vertex0 != face.Vertex2);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(face.Vertex1 != face.Vertex2);
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this._hasEdge(this.faces.get(face.Opposite0), face.Vertex2, face.Vertex1));
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this._hasEdge(this.faces.get(face.Opposite1), face.Vertex0, face.Vertex2));
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this._hasEdge(this.faces.get(face.Opposite2), face.Vertex1, face.Vertex0));
            const tmp = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Subtract(face.Normal, _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(points[face.Vertex0], points[face.Vertex1], points[face.Vertex2]));
            (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Magnitude(tmp) < QuickHull.EPSILON);
        }
    }
    _hasEdge(f, e0, e1) {
        if (f == undefined)
            return false;
        return (f.Vertex0 == e0 && f.Vertex1 == e1) || (f.Vertex1 == e0 && f.Vertex2 == e1) || (f.Vertex2 == e0 && f.Vertex0 == e1);
    }
}
QuickHull.UNASSIGNED = -2;
QuickHull.INSIDE = -1;
QuickHull.EPSILON = 0.0001;
//# sourceMappingURL=geometry.convex.quickhull.js.map

/***/ }),

/***/ "./dist/geometry/geometry.interfaces.js":
/*!**********************************************!*\
  !*** ./dist/geometry/geometry.interfaces.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsBounds: () => (/* binding */ IsBounds),
/* harmony export */   IsSize: () => (/* binding */ IsSize),
/* harmony export */   IsSize3: () => (/* binding */ IsSize3),
/* harmony export */   RegionCode: () => (/* binding */ RegionCode),
/* harmony export */   Side: () => (/* binding */ Side),
/* harmony export */   isArrayOfCartesianArray: () => (/* binding */ isArrayOfCartesianArray),
/* harmony export */   isCartesian: () => (/* binding */ isCartesian),
/* harmony export */   isCartesian3: () => (/* binding */ isCartesian3),
/* harmony export */   isCartesian4: () => (/* binding */ isCartesian4),
/* harmony export */   isCartesianArray: () => (/* binding */ isCartesianArray)
/* harmony export */ });
var RegionCode;
(function (RegionCode) {
    RegionCode[RegionCode["INSIDE"] = 0] = "INSIDE";
    RegionCode[RegionCode["LEFT"] = 1] = "LEFT";
    RegionCode[RegionCode["RIGHT"] = 2] = "RIGHT";
    RegionCode[RegionCode["BOTTOM"] = 4] = "BOTTOM";
    RegionCode[RegionCode["TOP"] = 8] = "TOP";
})(RegionCode || (RegionCode = {}));
function isCartesian(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.x !== undefined && b.y !== undefined;
}
function isCartesian3(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.x !== undefined && b.y !== undefined && b.z !== undefined;
}
function isCartesianArray(b) {
    return Array.isArray(b) && b.every(isCartesian);
}
function isArrayOfCartesianArray(input) {
    if (!Array.isArray(input)) {
        return false;
    }
    return input.every(isCartesianArray);
}
function isCartesian4(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.x !== undefined && b.y !== undefined && b.z !== undefined && b.w !== undefined;
}
var Side;
(function (Side) {
    Side[Side["left"] = 0] = "left";
    Side[Side["top"] = 1] = "top";
    Side[Side["right"] = 2] = "right";
    Side[Side["bottom"] = 3] = "bottom";
})(Side || (Side = {}));
function IsSize(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.height !== undefined && b.width !== undefined;
}
function IsSize3(size) {
    return IsSize(size) && size.thickness !== undefined;
}
function IsBounds(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.ymax !== undefined && b.xmin !== undefined && b.xmax !== undefined && b.ymin !== undefined;
}
//# sourceMappingURL=geometry.interfaces.js.map

/***/ }),

/***/ "./dist/geometry/geometry.plane.cruncher.js":
/*!**************************************************!*\
  !*** ./dist/geometry/geometry.plane.cruncher.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PlaneCruncher: () => (/* binding */ PlaneCruncher),
/* harmony export */   PlaneDefinition: () => (/* binding */ PlaneDefinition)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils */ "./dist/utils/runtime.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");


class PlaneDefinition {
    constructor(p, n, hull) {
        this._hull = [];
        this._point = p;
        this._normal = n;
        this._hull = hull;
    }
    get point() {
        return this._point;
    }
    get normal() {
        return this._normal;
    }
    get hull() {
        return this._hull;
    }
}
class NormalGroup {
    constructor(normal) {
        this.indices = new Set();
        this.center = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Zero();
        this.normal = normal;
    }
}
class PlaneCruncher {
    constructor() {
        this._positions = null;
        this._indices = null;
        this._groups = [];
    }
    withTolerance(tolerance) {
        this._tolerance = tolerance;
        return this;
    }
    withPositions(positions) {
        this._positions = positions;
        return this;
    }
    withIndices(indices) {
        this._indices = indices;
        return this;
    }
    crunch() {
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.Assert)(this._positions !== null && this._indices !== null, "Positions and indices must be set before crunching.");
        this._buildGroups(this._tolerance ?? PlaneCruncher.DEFAULT_TOLERANCE);
        const planes = [];
        for (let g of this._groups) {
            const t = this._createTranslationMatrix(g.center);
            const r = this._createRotationMatrix(g.normal);
            const m = this._multiplyMatrices(r, t);
            const inv = this._invertMatrix(m);
            const transformed = Array.from(g.indices).map((i) => {
                let p = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.FromArray(this._positions, i * 3);
                p = this._transformPoint(p, m);
                return { x: p.x, y: p.y };
            });
            const hull = this._grahamScan(transformed);
            const convertedHull = hull.map((p) => {
                const point = { x: p.x, y: p.y, z: 0 };
                return this._transformPoint(point, inv);
            });
            const p = new PlaneDefinition(g.center, g.normal, convertedHull);
            planes.push(p);
        }
        return planes;
    }
    _buildGroups(epsilon) {
        if (this._positions === null || this._indices === null)
            return;
        for (let i = 0; i != this._indices?.length; i += 3) {
            const i1 = this._indices[i];
            const i2 = this._indices[i + 1];
            const i3 = this._indices[i + 2];
            const p1 = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.FromArray(this._positions, i1 * 3);
            const p2 = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.FromArray(this._positions, i2 * 3);
            const p3 = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.FromArray(this._positions, i3 * 3);
            const normal = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normal(p1, p2, p3);
            let group = this._groups.find((g) => {
                if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Equals(g.normal, normal, epsilon)) {
                    return true;
                }
                return false;
            });
            if (group === undefined) {
                group = new NormalGroup(normal);
                this._groups.push(group);
            }
            group.indices.add(i1);
            group.indices.add(i2);
            group.indices.add(i3);
        }
        for (let g of this._groups) {
            g.center = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Centroid(Array.from(g.indices).map((i) => _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.FromArray(this._positions, i * 3)), g.center);
        }
    }
    _grahamScan(points) {
        if (points.length < 3) {
            throw new Error("At least three points are required");
        }
        let startPoint = points[0];
        for (const point of points) {
            if (point.y < startPoint.y || (point.y === startPoint.y && point.x < startPoint.x)) {
                startPoint = point;
            }
        }
        const sortedPoints = points.slice().sort((a, b) => {
            const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
            const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
            return angleA - angleB;
        });
        const hull = [sortedPoints[0], sortedPoints[1]];
        for (let i = 2; i < sortedPoints.length; i++) {
            while (hull.length >= 2) {
                const top = hull[hull.length - 1];
                const nextToTop = hull[hull.length - 2];
                const cross = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Dot(_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Subtract(top, nextToTop), _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.Subtract(sortedPoints[i], top));
                if (cross > 0) {
                    break;
                }
                hull.pop();
            }
            hull.push(sortedPoints[i]);
        }
        return hull;
    }
    _createTranslationMatrix(p) {
        return [
            [1, 0, 0, -p.x],
            [0, 1, 0, -p.y],
            [0, 0, 1, -p.z],
            [0, 0, 0, 1],
        ];
    }
    _createRotationMatrix(n) {
        const normalizedN = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Normalize(n);
        if (Math.abs(normalizedN.x) < 1e-6 && Math.abs(normalizedN.y) < 1e-6 && Math.abs(normalizedN.z - 1) < 1e-6) {
            return [
                [1, 0, 0, 0],
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ];
        }
        const axis = { x: normalizedN.y, y: -normalizedN.x, z: 0 };
        const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
        if (axisLength !== 0) {
            axis.x /= axisLength;
            axis.y /= axisLength;
        }
        const cosTheta = normalizedN.z;
        const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
        const oneMinusCosTheta = 1 - cosTheta;
        const { x: u, y: v } = axis;
        return [
            [cosTheta + u * u * oneMinusCosTheta, u * v * oneMinusCosTheta, v * sinTheta, 0],
            [u * v * oneMinusCosTheta, cosTheta + v * v * oneMinusCosTheta, -u * sinTheta, 0],
            [-v * sinTheta, u * sinTheta, cosTheta, 0],
            [0, 0, 0, 1],
        ];
    }
    _multiplyMatrices(a, b) {
        const result = Array.from({ length: 4 }, () => Array(4).fill(0));
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                for (let k = 0; k < 4; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return result;
    }
    _invertMatrix(matrix) {
        const m = JSON.parse(JSON.stringify(matrix));
        const inv = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ];
        for (let i = 0; i < 4; i++) {
            let pivot = m[i][i];
            if (pivot === 0) {
                for (let j = i + 1; j < 4; j++) {
                    if (m[j][i] !== 0) {
                        [m[i], m[j]] = [m[j], m[i]];
                        [inv[i], inv[j]] = [inv[j], inv[i]];
                        pivot = m[i][i];
                        break;
                    }
                }
            }
            for (let j = 0; j < 4; j++) {
                m[i][j] /= pivot;
                inv[i][j] /= pivot;
            }
            for (let j = 0; j < 4; j++) {
                if (i !== j) {
                    const factor = m[j][i];
                    for (let k = 0; k < 4; k++) {
                        m[j][k] -= factor * m[i][k];
                        inv[j][k] -= factor * inv[i][k];
                    }
                }
            }
        }
        return inv;
    }
    _transformPoint(point, transformationMatrix) {
        const pointHomogeneous = [point.x, point.y, point.z, 1];
        const transformedPointHomogeneous = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                transformedPointHomogeneous[i] += transformationMatrix[i][j] * pointHomogeneous[j];
            }
        }
        return {
            x: transformedPointHomogeneous[0] / transformedPointHomogeneous[3],
            y: transformedPointHomogeneous[1] / transformedPointHomogeneous[3],
            z: transformedPointHomogeneous[2] / transformedPointHomogeneous[3],
        };
    }
}
PlaneCruncher.DEFAULT_TOLERANCE = 0.0001;
//# sourceMappingURL=geometry.plane.cruncher.js.map

/***/ }),

/***/ "./dist/geometry/geometry.simplify.js":
/*!********************************************!*\
  !*** ./dist/geometry/geometry.simplify.js ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PolylineSimplifier: () => (/* binding */ PolylineSimplifier)
/* harmony export */ });
class PolylineSimplifier {
    constructor(tolerance = PolylineSimplifier.DEFAULT_TOLERANCE, highestQuality = false) {
        this._tolerance = tolerance;
        this._highestQuality = highestQuality;
    }
    simplify(points, tolerance, highestQuality) {
        if (points.length <= 2)
            return points;
        const toleranceValue = tolerance ?? this._tolerance;
        const highestQualityValue = highestQuality ?? this._highestQuality;
        points = highestQualityValue ? points : this._simplifyDouglasPeucker(points, toleranceValue);
        return this._simplifyRadialDist(points, this._tolerance);
    }
    _simplifyRadialDist(points, sqTolerance) {
        let prevPoint = points[0], newPoints = [prevPoint], point = prevPoint;
        for (var i = 1, len = points.length; i < len; i++) {
            point = points[i];
            if (this._getSqDist(point, prevPoint) > sqTolerance) {
                newPoints.push(point);
                prevPoint = point;
            }
        }
        if (prevPoint !== point)
            newPoints.push(point);
        return newPoints;
    }
    _simplifyDouglasPeucker(points, sqTolerance) {
        var last = points.length - 1;
        var simplified = [points[0]];
        this._simplifyDPStep(points, 0, last, sqTolerance, simplified);
        simplified.push(points[last]);
        return simplified;
    }
    _getSqDist(p1, p2) {
        var dx = p1.x - p2.x, dy = p1.y - p2.y;
        return dx * dx + dy * dy;
    }
    _getSqSegDist(p, p1, p2) {
        var x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
        if (dx !== 0 || dy !== 0) {
            var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) {
                x = p2.x;
                y = p2.y;
            }
            else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }
        dx = p.x - x;
        dy = p.y - y;
        return dx * dx + dy * dy;
    }
    _simplifyDPStep(points, first, last, sqTolerance, simplified) {
        var maxSqDist = sqTolerance, index;
        for (var i = first + 1; i < last; i++) {
            var sqDist = this._getSqSegDist(points[i], points[first], points[last]);
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }
        if (maxSqDist > sqTolerance) {
            if (index - first > 1)
                this._simplifyDPStep(points, first, index, sqTolerance, simplified);
            simplified.push(points[index]);
            if (last - index > 1)
                this._simplifyDPStep(points, index, last, sqTolerance, simplified);
        }
    }
}
PolylineSimplifier.DEFAULT_TOLERANCE = 1;
PolylineSimplifier.Shared = new PolylineSimplifier();
//# sourceMappingURL=geometry.simplify.js.map

/***/ }),

/***/ "./dist/geometry/geometry.size.js":
/*!****************************************!*\
  !*** ./dist/geometry/geometry.size.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Size2: () => (/* binding */ Size2),
/* harmony export */   Size3: () => (/* binding */ Size3)
/* harmony export */ });
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../math */ "./dist/math/math.units.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");


class Size2 {
    static ConvertInPlace(size, from, to) {
        return Size2.ConvertToRef(size, from, to, size);
    }
    static ConvertToRef(size, from, to, ref) {
        ref = ref ?? Size2.Zero();
        ref.width = _math__WEBPACK_IMPORTED_MODULE_0__.Quantity.Convert(size.width, from, to);
        ref.height = _math__WEBPACK_IMPORTED_MODULE_0__.Quantity.Convert(size.height, from, to);
        return ref;
    }
    static Zero() {
        return new Size2(0, 0);
    }
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    multiplyFloats(w, h) {
        return new Size2(this.width * w, this.height * (h ?? w));
    }
    clone() {
        return new Size2(this.width, this.height);
    }
    equals(other) {
        return this.height === other.height && this.width === other.width;
    }
}
class Size3 extends Size2 {
    static ConvertInPlace(size, from, to) {
        return Size3.ConvertToRef(size, from, to, size);
    }
    static ConvertToRef(size, from, to, ref) {
        ref = ref ?? Size3.Zero();
        ref.width = _math__WEBPACK_IMPORTED_MODULE_0__.Quantity.Convert(size.width, from, to);
        ref.height = _math__WEBPACK_IMPORTED_MODULE_0__.Quantity.Convert(size.height, from, to);
        ref.thickness = _math__WEBPACK_IMPORTED_MODULE_0__.Quantity.Convert(size.thickness, from, to);
        return ref;
    }
    static Zero() {
        return new Size3(0, 0, 0);
    }
    static FromSize(size) {
        if ((0,_geometry_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsSize3)(size)) {
            return new Size3(size.width, size.height, size.thickness);
        }
        return new Size3(size.width, size.height);
    }
    constructor(width, height, thickness = 0) {
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
/* harmony export */   AbstractShape: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.AbstractShape),
/* harmony export */   Bounded: () => (/* reexport safe */ _geometry_bounds__WEBPACK_IMPORTED_MODULE_2__.Bounded),
/* harmony export */   BoundedCollection: () => (/* reexport safe */ _geometry_bounds_collection__WEBPACK_IMPORTED_MODULE_3__.BoundedCollection),
/* harmony export */   Bounds2: () => (/* reexport safe */ _geometry_bounds__WEBPACK_IMPORTED_MODULE_2__.Bounds2),
/* harmony export */   Cartesian2: () => (/* reexport safe */ _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__.Cartesian2),
/* harmony export */   Cartesian3: () => (/* reexport safe */ _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__.Cartesian3),
/* harmony export */   Cartesian4: () => (/* reexport safe */ _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__.Cartesian4),
/* harmony export */   Circle: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.Circle),
/* harmony export */   IsBounds: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsBounds),
/* harmony export */   IsSize: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsSize),
/* harmony export */   IsSize3: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsSize3),
/* harmony export */   Line: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.Line),
/* harmony export */   PlaneCruncher: () => (/* reexport safe */ _geometry_plane_cruncher__WEBPACK_IMPORTED_MODULE_6__.PlaneCruncher),
/* harmony export */   PlaneDefinition: () => (/* reexport safe */ _geometry_plane_cruncher__WEBPACK_IMPORTED_MODULE_6__.PlaneDefinition),
/* harmony export */   Point: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.Point),
/* harmony export */   Polygon: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.Polygon),
/* harmony export */   Polyline: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.Polyline),
/* harmony export */   PolylineSimplifier: () => (/* reexport safe */ _geometry_simplify__WEBPACK_IMPORTED_MODULE_8__.PolylineSimplifier),
/* harmony export */   QuickHull: () => (/* reexport safe */ _geometry_convex_quickhull__WEBPACK_IMPORTED_MODULE_5__.QuickHull),
/* harmony export */   RegionCode: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.RegionCode),
/* harmony export */   ShapeType: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.ShapeType),
/* harmony export */   Side: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side),
/* harmony export */   Size2: () => (/* reexport safe */ _geometry_size__WEBPACK_IMPORTED_MODULE_4__.Size2),
/* harmony export */   Size3: () => (/* reexport safe */ _geometry_size__WEBPACK_IMPORTED_MODULE_4__.Size3),
/* harmony export */   isArrayOfCartesianArray: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isArrayOfCartesianArray),
/* harmony export */   isCartesian: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isCartesian),
/* harmony export */   isCartesian3: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isCartesian3),
/* harmony export */   isCartesian4: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isCartesian4),
/* harmony export */   isCartesianArray: () => (/* reexport safe */ _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.isCartesianArray),
/* harmony export */   isCircle: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.isCircle),
/* harmony export */   isClipable: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.isClipable),
/* harmony export */   isLine: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.isLine),
/* harmony export */   isPolygon: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.isPolygon),
/* harmony export */   isPolyline: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.isPolyline),
/* harmony export */   isShape: () => (/* reexport safe */ _shapes__WEBPACK_IMPORTED_MODULE_7__.isShape)
/* harmony export */ });
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_bounds__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geometry.bounds */ "./dist/geometry/geometry.bounds.js");
/* harmony import */ var _geometry_bounds_collection__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geometry.bounds.collection */ "./dist/geometry/geometry.bounds.collection.js");
/* harmony import */ var _geometry_size__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geometry.size */ "./dist/geometry/geometry.size.js");
/* harmony import */ var _geometry_convex_quickhull__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./geometry.convex.quickhull */ "./dist/geometry/geometry.convex.quickhull.js");
/* harmony import */ var _geometry_plane_cruncher__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./geometry.plane.cruncher */ "./dist/geometry/geometry.plane.cruncher.js");
/* harmony import */ var _shapes__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./shapes */ "./dist/geometry/shapes/index.js");
/* harmony import */ var _geometry_simplify__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./geometry.simplify */ "./dist/geometry/geometry.simplify.js");









//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/geometry/shapes/geometry.circle.js":
/*!*************************************************!*\
  !*** ./dist/geometry/shapes/geometry.circle.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Circle: () => (/* binding */ Circle)
/* harmony export */ });
/* harmony import */ var _geometry_bounds__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry.bounds */ "./dist/geometry/geometry.bounds.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_shape__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.shape */ "./dist/geometry/shapes/geometry.shape.js");
/* harmony import */ var _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.shapes.interfaces */ "./dist/geometry/shapes/geometry.shapes.interfaces.js");




class Circle extends _geometry_shape__WEBPACK_IMPORTED_MODULE_0__.AbstractShape {
    constructor(c, radius) {
        super(_geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__.ShapeType.Circle);
        this._center = c;
        this._radius = radius;
    }
    get center() {
        return this._center;
    }
    set center(v) {
        if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3.Equals(v, this._center) == false) {
            this._center = v;
            this.invalidateBounds();
        }
    }
    get radius() {
        return this._radius;
    }
    set radius(v) {
        if (this._radius !== v) {
            this._radius = v;
            this.invalidateBounds();
        }
    }
    _buildBounds() {
        const r = this._radius;
        const x = this._center.x;
        const y = this._center.y;
        return new _geometry_bounds__WEBPACK_IMPORTED_MODULE_3__.Bounds2(x - r, y - r, r * 2, r * 2);
    }
    _getPoints() {
        return [this._center];
    }
}
//# sourceMappingURL=geometry.circle.js.map

/***/ }),

/***/ "./dist/geometry/shapes/geometry.line.js":
/*!***********************************************!*\
  !*** ./dist/geometry/shapes/geometry.line.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Line: () => (/* binding */ Line)
/* harmony export */ });
/* harmony import */ var _geometry_bounds__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../geometry.bounds */ "./dist/geometry/geometry.bounds.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");
/* harmony import */ var _geometry_shape__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.shape */ "./dist/geometry/shapes/geometry.shape.js");
/* harmony import */ var _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.shapes.interfaces */ "./dist/geometry/shapes/geometry.shapes.interfaces.js");





class Line extends _geometry_shape__WEBPACK_IMPORTED_MODULE_0__.AbstractShape {
    constructor(a, b) {
        super(_geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__.ShapeType.Line);
        this._alice = a;
        this._bob = b;
    }
    get start() {
        return this._alice;
    }
    set start(v) {
        if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3.Equals(v, this._alice) == false) {
            this._alice = v;
            this.invalidateBounds();
        }
    }
    get end() {
        return this._bob;
    }
    set end(v) {
        if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3.Equals(v, this._bob) == false) {
            this._bob = v;
            this.invalidateBounds();
        }
    }
    clip(clipArea) {
        let code1 = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.ComputeCode(this._alice, clipArea);
        let code2 = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.ComputeCode(this._bob, clipArea);
        if (code1 == 0 && code2 == 0) {
            return this;
        }
        if (code1 & code2) {
            return undefined;
        }
        let a = new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3(this._alice.x, this._alice.y, this._alice.z);
        let b = new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3(this._bob.x, this._bob.y, this._bob.z);
        do {
            let code_out = code1 != 0 ? code1 : code2;
            let x = 0, y = 0;
            const x1 = a.x;
            const y1 = a.y;
            const x2 = b.x;
            const y2 = b.y;
            if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.TOP) {
                const y_max = clipArea.ymax;
                x = x1 + ((x2 - x1) * (y_max - y1)) / (y2 - y1);
                y = y_max;
            }
            else if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.BOTTOM) {
                const y_min = clipArea.ymin;
                x = x1 + ((x2 - x1) * (y_min - y1)) / (y2 - y1);
                y = y_min;
            }
            else if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.RIGHT) {
                const x_max = clipArea.xmax;
                y = y1 + ((y2 - y1) * (x_max - x1)) / (x2 - x1);
                x = x_max;
            }
            else if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.LEFT) {
                const x_min = clipArea.xmin;
                y = y1 + ((y2 - y1) * (x_min - x1)) / (x2 - x1);
                x = x_min;
            }
            if (code_out == code1) {
                a.x = x;
                a.y = y;
                code1 = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.ComputeCode(a, clipArea);
            }
            else {
                b.x = x;
                b.y = y;
                code2 = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.ComputeCode(b, clipArea);
            }
        } while (code1 != 0 || code2 != 0);
        return new Line(a, b);
    }
    _buildBounds() {
        return _geometry_bounds__WEBPACK_IMPORTED_MODULE_4__.Bounds2.FromPoints(this._alice, this._bob);
    }
    _getPoints() {
        return [this._alice, this._bob];
    }
}
//# sourceMappingURL=geometry.line.js.map

/***/ }),

/***/ "./dist/geometry/shapes/geometry.point.js":
/*!************************************************!*\
  !*** ./dist/geometry/shapes/geometry.point.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Point: () => (/* binding */ Point)
/* harmony export */ });
/* harmony import */ var _geometry_bounds__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../geometry.bounds */ "./dist/geometry/geometry.bounds.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");
/* harmony import */ var _geometry_shape__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.shape */ "./dist/geometry/shapes/geometry.shape.js");
/* harmony import */ var _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.shapes.interfaces */ "./dist/geometry/shapes/geometry.shapes.interfaces.js");





class Point extends _geometry_shape__WEBPACK_IMPORTED_MODULE_0__.AbstractShape {
    constructor(a, b, c) {
        super(_geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_1__.ShapeType.Point);
        if ((0,_geometry_interfaces__WEBPACK_IMPORTED_MODULE_2__.isCartesian)(a)) {
            this._position = a;
        }
        else {
            this._position = new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian3(a, b ?? 0, c ?? 0);
        }
    }
    get position() {
        return this._position;
    }
    set position(v) {
        if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian3.Equals(v, this._position) == false) {
            this._position = v;
            this.invalidateBounds();
        }
    }
    clip(clipArea) {
        let code = _geometry_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.ComputeCode(this._position, clipArea);
        if (code == 0) {
            return this;
        }
        return undefined;
    }
    _buildBounds() {
        return _geometry_bounds__WEBPACK_IMPORTED_MODULE_4__.Bounds2.FromPoints(this._position);
    }
    _getPoints() {
        return [this._position];
    }
}
//# sourceMappingURL=geometry.point.js.map

/***/ }),

/***/ "./dist/geometry/shapes/geometry.polygon.js":
/*!**************************************************!*\
  !*** ./dist/geometry/shapes/geometry.polygon.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Polygon: () => (/* binding */ Polygon)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../types */ "./dist/types.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");
/* harmony import */ var _geometry_polyline__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.polyline */ "./dist/geometry/shapes/geometry.polyline.js");
/* harmony import */ var _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geometry.shapes.interfaces */ "./dist/geometry/shapes/geometry.shapes.interfaces.js");





class Cartesian3WithInfos extends _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3 {
    constructor(x, y, z, __wayCode__$t1967, subject, subjectIndex, clipIndex = 0) {
        super(x, y, z);
        this.__wayCode__$t1967 = __wayCode__$t1967;
        this.subject = subject;
        this.subjectIndex = subjectIndex;
        this.clipIndex = clipIndex;
    }
}
function isIntersection(p) {
    return p.__wayCode__$t1967 !== undefined;
}
class Polygon extends _geometry_polyline__WEBPACK_IMPORTED_MODULE_1__.Polyline {
    static IsClockWise(points) {
        let sum = 0;
        const n = points.length;
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[(i + 1) % n];
            sum += (b.x - a.x) * (b.y + a.y);
        }
        return sum < 0;
    }
    static FromFloats(points, stride = 3, assertClose = true, assertClockWize = true) {
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.isArrayOfFloatArray)(points)) {
            const records = [];
            for (let i = 0; i < points.length; i++) {
                const tmp = points[i];
                const p = [];
                for (let j = 0; j < tmp.length; j += stride) {
                    p.push(new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3(tmp[j], tmp[j + 1], stride > 2 ? tmp[j + 2] : 0));
                }
                records.push(p);
            }
            return Polygon.FromPoints(records, assertClose, assertClockWize);
        }
        const p = [];
        for (let i = 0; i < points.length; i += stride) {
            p.push(new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3(points[i], points[i + 1], stride > 2 ? points[i + 2] : 0));
        }
        return new Polygon(p, assertClose, assertClockWize);
    }
    static FromPoints(points, assertClose = true, assertClockWize = true) {
        if ((0,_geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.isArrayOfCartesianArray)(points)) {
            const p = new Polygon(points[0], assertClose, assertClockWize);
            for (let i = 1; i < points.length; i++) {
                p.addHole(points[i], assertClose, assertClockWize);
            }
            return p;
        }
        return new Polygon(points, assertClose, assertClockWize);
    }
    constructor(p, assertClose = true, assertClockWize = true) {
        super(p, _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_4__.ShapeType.Polygon);
        if (assertClose && !_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Equals(p[0], p[p.length - 1])) {
            p.push(p[0]);
        }
        if (assertClockWize && !Polygon.IsClockWise(p)) {
            p.reverse();
        }
    }
    get holes() {
        return this._holes;
    }
    addHole(hole, assertClose = true, assertAntiClockWize = true) {
        if ((hole?.length ?? 0) > 2) {
            if (assertClose && !_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.Equals(hole[0], hole[hole.length - 1])) {
                hole.push(hole[0]);
            }
            if (assertAntiClockWize && Polygon.IsClockWise(hole)) {
                hole.reverse();
            }
            this._holes = this._holes ?? [];
            this._holes.push(hole);
        }
    }
    clip(clipArea) {
        if (clipArea.containsBounds(this.bounds)) {
            return this;
        }
        return this._clipPolygon(clipArea);
    }
    _clipPolygon(clipArea) {
        if (clipArea.intersects(this.bounds)) {
            const polygonArea = Array.from(clipArea.points()).map((p) => this._buildPoint(p.x, p.y, 0));
            polygonArea.push(polygonArea[0]);
            const toClips = [this._points];
            if (this._holes) {
                toClips.push(...this._holes);
            }
            const entering = [];
            for (const subject of toClips) {
                const points = [];
                const codes = subject.map((p) => _geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian2.ComputeCode(p, clipArea));
                let a = subject[0];
                let codea = codes[0];
                let inside = codea == 0;
                for (let i = 1; i < codes.length; i++) {
                    const b = subject[i];
                    const codeb = codes[i];
                    if (inside) {
                        points.push(this._buildPoint(a.x, a.y, a.z));
                        if (codeb != 0) {
                            const intersection = this._computeIntersectionToRef(clipArea, a, b, codeb, new Cartesian3WithInfos(0, 0, 0, false, points, points.length));
                            points.push(intersection);
                            intersection.clipIndex = this._InsertIntersectionIntoClipPolygon(polygonArea, intersection);
                            inside = !inside;
                        }
                    }
                    else {
                        points.push(a);
                        if (codeb == 0) {
                            const intersection = this._computeIntersectionToRef(clipArea, a, b, codea, new Cartesian3WithInfos(0, 0, 0, true, points, points.length));
                            entering.push(intersection);
                            points.push(intersection);
                            intersection.clipIndex = this._InsertIntersectionIntoClipPolygon(polygonArea, intersection);
                            inside = !inside;
                        }
                    }
                    a = b;
                    codea = codeb;
                }
                if (inside) {
                    points.push(this._buildPoint(a.x, a.y, a.z));
                }
            }
            const polygons = [];
            if (entering.length != 0) {
                do {
                    const polygon = [];
                    const first = entering.splice(0, 1)[0];
                    let i = first.subjectIndex;
                    let subject = first.subject;
                    do {
                        const current = subject[i++];
                        i == subject.length && (i = 1);
                        if (isIntersection(current)) {
                            polygon.push(this._buildPoint(current.x, current.y, current.z));
                            if (!current.__wayCode__$t1967) {
                                i = current.clipIndex + 1;
                                subject = polygonArea;
                                continue;
                            }
                            if (polygon.length == 1) {
                                continue;
                            }
                            if (current === first) {
                                polygons.push(polygon);
                                break;
                            }
                            i = current.subjectIndex + 1;
                            subject = current.subject;
                            entering.splice(entering.findIndex((p) => p === current), 1);
                            continue;
                        }
                        polygon.push(current);
                    } while (true);
                } while (entering.length > 0);
            }
            return polygons.length ? (polygons.length == 1 ? new Polygon(polygons[0], false, false) : polygons.map((p) => new Polygon(p, false, false))) : undefined;
        }
        return undefined;
    }
    _InsertIntersectionIntoClipPolygon(clipPolygon, intersection) {
        let a = clipPolygon[0];
        for (let i = 1; i < clipPolygon.length; i++) {
            const b = clipPolygon[i];
            if (_geometry_cartesian__WEBPACK_IMPORTED_MODULE_0__.Cartesian3.IsWithinTheBounds(a, b, intersection)) {
                clipPolygon.splice(i, 0, intersection);
                for (let j = i + 1; j < clipPolygon.length; j++) {
                    const c = clipPolygon[j];
                    if (isIntersection(c)) {
                        c.clipIndex++;
                    }
                }
                return i;
            }
            a = b;
        }
        return -1;
    }
}
//# sourceMappingURL=geometry.polygon.js.map

/***/ }),

/***/ "./dist/geometry/shapes/geometry.polyline.js":
/*!***************************************************!*\
  !*** ./dist/geometry/shapes/geometry.polyline.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Polyline: () => (/* binding */ Polyline)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../types */ "./dist/types.js");
/* harmony import */ var _geometry_bounds__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../geometry.bounds */ "./dist/geometry/geometry.bounds.js");
/* harmony import */ var _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry.cartesian */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");
/* harmony import */ var _geometry_shape__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.shape */ "./dist/geometry/shapes/geometry.shape.js");
/* harmony import */ var _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geometry.shapes.interfaces */ "./dist/geometry/shapes/geometry.shapes.interfaces.js");






class Polyline extends _geometry_shape__WEBPACK_IMPORTED_MODULE_0__.AbstractShape {
    static ArraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) {
            return false;
        }
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) {
                return false;
            }
        }
        return true;
    }
    static FromFloats(points, stride = 3) {
        if ((0,_types__WEBPACK_IMPORTED_MODULE_1__.isArrayOfFloatArray)(points)) {
            const multipolyline = [];
            for (let i = 0; i < points.length; i++) {
                const tmp = points[i];
                const p = [];
                for (let j = 0; j < tmp.length; j += stride) {
                    p.push(new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3(tmp[j], tmp[j + 1], stride > 2 ? tmp[j + 2] : 0));
                }
                multipolyline.push(new Polyline(p));
            }
            return multipolyline;
        }
        const p = [];
        for (let i = 0; i < points.length; i += stride) {
            p.push(new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3(points[i], points[i + 1], stride > 2 ? points[i + 2] : 0));
        }
        return new Polyline(p);
    }
    static FromPoints(points) {
        if ((0,_geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.isArrayOfCartesianArray)(points)) {
            return Polyline.FromPoints(points.flat());
        }
        return new Polyline(points);
    }
    constructor(p, type) {
        super(type ?? _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_4__.ShapeType.Polyline);
        this._points = p;
    }
    get points() {
        return this._points;
    }
    clip(clipArea) {
        if (clipArea.containsBounds(this.bounds)) {
            return this;
        }
        return this._clipPolyline(clipArea);
    }
    _clipPolyline(clipArea) {
        if (clipArea.intersects(this.bounds)) {
            const polylines = [];
            let points = [];
            const codes = this._points.map((p) => _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.ComputeCode(p, clipArea));
            let a = this._points[0];
            let codea = codes[0];
            let inside = codea == 0;
            for (let i = 1; i < codes.length; i++) {
                const b = this._points[i];
                const codeb = codes[i];
                if (inside) {
                    points.push(this._buildPoint(a.x, a.y, a.z));
                    if (codeb != 0) {
                        const intersection = this._computeIntersectionToRef(clipArea, a, b, codeb, this._buildPoint(0, 0, 0));
                        points.push(intersection);
                        polylines.push(new Polyline(points));
                        points = [];
                        inside = !inside;
                    }
                }
                else {
                    if (codeb == 0) {
                        const intersection = this._computeIntersectionToRef(clipArea, a, b, codea, this._buildPoint(0, 0, 0));
                        points.push(intersection);
                        inside = !inside;
                    }
                }
                a = b;
                codea = codeb;
            }
            if (inside) {
                points.push(this._buildPoint(a.x, a.y, a.z));
            }
            if (points.length) {
                polylines.push(new Polyline(points));
            }
            return polylines.length ? (polylines.length == 1 ? polylines[0] : polylines) : undefined;
        }
        return undefined;
    }
    _computeIntersectionToRef(clipArea, a, b, code_out, ref) {
        const x1 = a.x;
        const y1 = a.y;
        const x2 = b.x;
        const y2 = b.y;
        if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.TOP) {
            const y_max = clipArea.ymax;
            ref.x = x1 + ((x2 - x1) * (y_max - y1)) / (y2 - y1);
            ref.y = y_max;
        }
        else if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.BOTTOM) {
            const y_min = clipArea.ymin;
            ref.x = x1 + ((x2 - x1) * (y_min - y1)) / (y2 - y1);
            ref.y = y_min;
        }
        else if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.RIGHT) {
            const x_max = clipArea.xmax;
            ref.y = y1 + ((y2 - y1) * (x_max - x1)) / (x2 - x1);
            ref.x = x_max;
        }
        else if (code_out & _geometry_interfaces__WEBPACK_IMPORTED_MODULE_3__.RegionCode.LEFT) {
            const x_min = clipArea.xmin;
            ref.y = y1 + ((y2 - y1) * (x_min - x1)) / (x2 - x1);
            ref.x = x_min;
        }
        return ref;
    }
    _buildPoint(x, y, z) {
        return new _geometry_cartesian__WEBPACK_IMPORTED_MODULE_2__.Cartesian3(x ?? 0, y ?? 0, z ?? 0);
    }
    _buildBounds() {
        return _geometry_bounds__WEBPACK_IMPORTED_MODULE_5__.Bounds2.FromPoints(...this._points);
    }
    _getPoints() {
        return this._points;
    }
}
//# sourceMappingURL=geometry.polyline.js.map

/***/ }),

/***/ "./dist/geometry/shapes/geometry.shape.js":
/*!************************************************!*\
  !*** ./dist/geometry/shapes/geometry.shape.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractShape: () => (/* binding */ AbstractShape)
/* harmony export */ });
/* harmony import */ var _geometry_bounds__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../geometry.bounds */ "./dist/geometry/geometry.bounds.js");

class AbstractShape extends _geometry_bounds__WEBPACK_IMPORTED_MODULE_0__.Bounded {
    constructor(t) {
        super();
        this._type = t;
    }
    get type() {
        return this._type;
    }
    [Symbol.iterator]() {
        let index = 0;
        let points = this._getPoints();
        return {
            next() {
                if (index < points.length) {
                    return { value: points[index++], done: false };
                }
                else {
                    return { value: null, done: true };
                }
            },
        };
    }
}
//# sourceMappingURL=geometry.shape.js.map

/***/ }),

/***/ "./dist/geometry/shapes/geometry.shapes.interfaces.js":
/*!************************************************************!*\
  !*** ./dist/geometry/shapes/geometry.shapes.interfaces.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ShapeType: () => (/* binding */ ShapeType),
/* harmony export */   isCircle: () => (/* binding */ isCircle),
/* harmony export */   isClipable: () => (/* binding */ isClipable),
/* harmony export */   isLine: () => (/* binding */ isLine),
/* harmony export */   isPolygon: () => (/* binding */ isPolygon),
/* harmony export */   isPolyline: () => (/* binding */ isPolyline),
/* harmony export */   isShape: () => (/* binding */ isShape)
/* harmony export */ });
var ShapeType;
(function (ShapeType) {
    ShapeType[ShapeType["Unknown"] = 0] = "Unknown";
    ShapeType[ShapeType["Point"] = 1] = "Point";
    ShapeType[ShapeType["Polyline"] = 2] = "Polyline";
    ShapeType[ShapeType["Polygon"] = 3] = "Polygon";
    ShapeType[ShapeType["Circle"] = 4] = "Circle";
    ShapeType[ShapeType["Line"] = 5] = "Line";
})(ShapeType || (ShapeType = {}));
function isClipable(value) {
    return value && value.clip !== undefined;
}
function isShape(value) {
    return value && value.type !== undefined && ShapeType[value.type] !== undefined;
}
function isCircle(shape) {
    if (typeof shape !== "object" || shape === null)
        return false;
    return shape.type === ShapeType.Circle;
}
function isLine(shape) {
    if (typeof shape !== "object" || shape === null)
        return false;
    return shape.type === ShapeType.Line;
}
function isPolyline(shape) {
    if (typeof shape !== "object" || shape === null)
        return false;
    return shape.type === ShapeType.Polyline;
}
function isPolygon(shape) {
    if (typeof shape !== "object" || shape === null)
        return false;
    return shape.type === ShapeType.Polygon;
}
//# sourceMappingURL=geometry.shapes.interfaces.js.map

/***/ }),

/***/ "./dist/geometry/shapes/index.js":
/*!***************************************!*\
  !*** ./dist/geometry/shapes/index.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractShape: () => (/* reexport safe */ _geometry_shape__WEBPACK_IMPORTED_MODULE_1__.AbstractShape),
/* harmony export */   Circle: () => (/* reexport safe */ _geometry_circle__WEBPACK_IMPORTED_MODULE_2__.Circle),
/* harmony export */   Line: () => (/* reexport safe */ _geometry_line__WEBPACK_IMPORTED_MODULE_5__.Line),
/* harmony export */   Point: () => (/* reexport safe */ _geometry_point__WEBPACK_IMPORTED_MODULE_6__.Point),
/* harmony export */   Polygon: () => (/* reexport safe */ _geometry_polygon__WEBPACK_IMPORTED_MODULE_3__.Polygon),
/* harmony export */   Polyline: () => (/* reexport safe */ _geometry_polyline__WEBPACK_IMPORTED_MODULE_4__.Polyline),
/* harmony export */   ShapeType: () => (/* reexport safe */ _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.ShapeType),
/* harmony export */   isCircle: () => (/* reexport safe */ _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.isCircle),
/* harmony export */   isClipable: () => (/* reexport safe */ _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.isClipable),
/* harmony export */   isLine: () => (/* reexport safe */ _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.isLine),
/* harmony export */   isPolygon: () => (/* reexport safe */ _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.isPolygon),
/* harmony export */   isPolyline: () => (/* reexport safe */ _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.isPolyline),
/* harmony export */   isShape: () => (/* reexport safe */ _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__.isShape)
/* harmony export */ });
/* harmony import */ var _geometry_shapes_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./geometry.shapes.interfaces */ "./dist/geometry/shapes/geometry.shapes.interfaces.js");
/* harmony import */ var _geometry_shape__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./geometry.shape */ "./dist/geometry/shapes/geometry.shape.js");
/* harmony import */ var _geometry_circle__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./geometry.circle */ "./dist/geometry/shapes/geometry.circle.js");
/* harmony import */ var _geometry_polygon__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geometry.polygon */ "./dist/geometry/shapes/geometry.polygon.js");
/* harmony import */ var _geometry_polyline__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geometry.polyline */ "./dist/geometry/shapes/geometry.polyline.js");
/* harmony import */ var _geometry_line__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./geometry.line */ "./dist/geometry/shapes/geometry.line.js");
/* harmony import */ var _geometry_point__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./geometry.point */ "./dist/geometry/shapes/geometry.point.js");







//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/map/canvas/index.js":
/*!**********************************!*\
  !*** ./dist/map/canvas/index.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CanvasDisplay: () => (/* reexport safe */ _map_canvas_display__WEBPACK_IMPORTED_MODULE_2__.CanvasDisplay),
/* harmony export */   CanvasMap: () => (/* reexport safe */ _map_canvas__WEBPACK_IMPORTED_MODULE_1__.CanvasMap),
/* harmony export */   Context2DTileMap: () => (/* reexport safe */ _map_context2d__WEBPACK_IMPORTED_MODULE_0__.Context2DTileMap)
/* harmony export */ });
/* harmony import */ var _map_context2d__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./map.context2d */ "./dist/map/canvas/map.context2d.js");
/* harmony import */ var _map_canvas__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./map.canvas */ "./dist/map/canvas/map.canvas.js");
/* harmony import */ var _map_canvas_display__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./map.canvas.display */ "./dist/map/canvas/map.canvas.display.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/map/canvas/map.canvas.display.js":
/*!***********************************************!*\
  !*** ./dist/map/canvas/map.canvas.display.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CanvasDisplay: () => (/* binding */ CanvasDisplay)
/* harmony export */ });
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../tiles */ "./dist/tiles/display/tiles.display.js");

class CanvasDisplay extends _tiles__WEBPACK_IMPORTED_MODULE_0__.Display {
    static CreateCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    static ResizeToDisplaySize(canvas, scale = 1) {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        const ratio = window.devicePixelRatio;
        const w = displayWidth * ratio * scale;
        const h = displayHeight * ratio * scale;
        if (canvas.width != w || canvas.height != h) {
            canvas.width = w;
            canvas.height = h;
            return true;
        }
        return false;
    }
    constructor(canvas, scale, resizeToFitClient) {
        const f = resizeToFitClient == undefined || resizeToFitClient == true;
        scale = scale ?? 1.0;
        if (f) {
            CanvasDisplay.ResizeToDisplaySize(canvas, scale);
        }
        super(canvas);
        this.canvas = canvas;
        this._resizeToFitClient = f;
        this._scale = scale;
        this._resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.target === canvas) {
                    if (this._resizeToFitClient) {
                        CanvasDisplay.ResizeToDisplaySize(canvas, this._scale);
                    }
                    this.resize(canvas.width, canvas.height);
                }
            }
        });
        this._resizeObserver.observe(canvas);
    }
    getContext(options) {
        return this.canvas.getContext("2d", options);
    }
    dispose() {
        super.dispose();
        this._resizeObserver.disconnect();
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
/* harmony export */   CanvasMap: () => (/* binding */ CanvasMap)
/* harmony export */ });
/* harmony import */ var _map_canvas_display__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./map.canvas.display */ "./dist/map/canvas/map.canvas.display.js");
/* harmony import */ var _inputs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../inputs */ "./dist/map/inputs/map.inputs.navigation.js");
/* harmony import */ var _inputs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../inputs */ "./dist/map/inputs/map.inputs.pointer.js");
/* harmony import */ var _map_context2d__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./map.context2d */ "./dist/map/canvas/map.context2d.js");



class CanvasMap extends _map_context2d__WEBPACK_IMPORTED_MODULE_0__.Context2DTileMap {
    constructor(display, options, nav) {
        if (display instanceof HTMLCanvasElement) {
            display = new _map_canvas_display__WEBPACK_IMPORTED_MODULE_1__.CanvasDisplay(display);
        }
        super(display, nav);
        this._context = display.getContext();
        this._navigationManager = options?.navigationManager ?? new _inputs__WEBPACK_IMPORTED_MODULE_2__.InputsNavigationTarget(this);
        this._inputController = options?.inputController ?? new _inputs__WEBPACK_IMPORTED_MODULE_3__.PointerInputController(display.canvas, this._navigationManager);
    }
    _doValidate() {
        super._doValidate();
        const ctx = this._getContext2D();
        if (ctx) {
            this.draw(ctx);
        }
    }
    _getContext2D() {
        return this._context;
    }
}
//# sourceMappingURL=map.canvas.js.map

/***/ }),

/***/ "./dist/map/canvas/map.context2d.js":
/*!******************************************!*\
  !*** ./dist/map/canvas/map.context2d.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Context2DTileMap: () => (/* binding */ Context2DTileMap)
/* harmony export */ });
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../math */ "./dist/math/math.js");
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../tiles */ "./dist/tiles/map/tiles.map.js");
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../tiles */ "./dist/tiles/map/tiles.map.interfaces.js");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../types */ "./dist/types.js");



class Context2DTileMap extends _tiles__WEBPACK_IMPORTED_MODULE_0__.TileMapBase {
    constructor(display, nav) {
        super(display, nav);
    }
    draw(ctx, xoffset = 0, yoffset = 0) {
        if (!ctx || !this._display) {
            return;
        }
        if (!this._layerViews.count) {
            return;
        }
        const display = this.display;
        if (!display) {
            return;
        }
        ctx.save();
        try {
            const x = xoffset;
            const y = yoffset;
            const w = display.resolution.width;
            const h = display.resolution.height;
            const scale = this.navigation.scale;
            ctx.clearRect(x, y, w, h);
            ctx.translate(x + w / 2, y + h / 2);
            if (this.navigation.azimuth?.value) {
                const angle = this.navigation.azimuth.value * _math__WEBPACK_IMPORTED_MODULE_1__.Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            ctx.scale(scale, scale);
            for (const view of this._layerViews) {
                const layer = view.layer;
                if (!layer.enabled) {
                    continue;
                }
                const render = (0,_tiles__WEBPACK_IMPORTED_MODULE_2__.IsDrawableTileMapLayer)(layer) ? layer.drawFn?.bind(layer.drawTarget ?? layer) : undefined;
                if (!render) {
                    continue;
                }
                const currentLod = this.navigation.lod;
                const lat = this.navigation.center.lat;
                const lon = this.navigation.center.lon;
                const metrics = layer.metrics;
                const center = metrics.getLatLonToPointXY(lat, lon, currentLod);
                const size = metrics.tileSize;
                if ((0,_types__WEBPACK_IMPORTED_MODULE_3__.isValidable)(view)) {
                    view.validate();
                }
                const tiles = view.activTiles;
                for (const tile of tiles) {
                    const b = tile?.bounds;
                    if (!b || !tile.content) {
                        continue;
                    }
                    const dlod = currentLod - tile.address.levelOfDetail;
                    const lodScaling = dlod == 0 ? 1 : dlod < 0 ? 1 << dlod : 1 / (1 << dlod);
                    const x = b.x * lodScaling - center.x;
                    const y = b.y * lodScaling - center.y;
                    ctx.save();
                    try {
                        ctx.translate(x, y);
                        ctx.scale(lodScaling, lodScaling);
                        render(ctx, tile, size, size);
                    }
                    finally {
                        ctx.restore();
                    }
                    continue;
                }
            }
        }
        finally {
            ctx.restore();
        }
    }
}
//# sourceMappingURL=map.context2d.js.map

/***/ }),

/***/ "./dist/map/index.js":
/*!***************************!*\
  !*** ./dist/map/index.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CanvasDisplay: () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.CanvasDisplay),
/* harmony export */   CanvasMap: () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.CanvasMap),
/* harmony export */   Cartesian2WithInfos: () => (/* reexport safe */ _inputs_index__WEBPACK_IMPORTED_MODULE_1__.Cartesian2WithInfos),
/* harmony export */   Context2DTileMap: () => (/* reexport safe */ _canvas_index__WEBPACK_IMPORTED_MODULE_0__.Context2DTileMap),
/* harmony export */   InputControllerBase: () => (/* reexport safe */ _inputs_index__WEBPACK_IMPORTED_MODULE_1__.InputControllerBase),
/* harmony export */   InputsNavigationTarget: () => (/* reexport safe */ _inputs_index__WEBPACK_IMPORTED_MODULE_1__.InputsNavigationTarget),
/* harmony export */   MouseInputController: () => (/* reexport safe */ _inputs_index__WEBPACK_IMPORTED_MODULE_1__.MouseInputController),
/* harmony export */   PointerController: () => (/* reexport safe */ _inputs_index__WEBPACK_IMPORTED_MODULE_1__.PointerController),
/* harmony export */   PointerInputController: () => (/* reexport safe */ _inputs_index__WEBPACK_IMPORTED_MODULE_1__.PointerInputController),
/* harmony export */   isSupportingTouch: () => (/* reexport safe */ _inputs_index__WEBPACK_IMPORTED_MODULE_1__.isSupportingTouch)
/* harmony export */ });
/* harmony import */ var _canvas_index__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./canvas/index */ "./dist/map/canvas/index.js");
/* harmony import */ var _inputs_index__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./inputs/index */ "./dist/map/inputs/index.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/map/inputs/index.js":
/*!**********************************!*\
  !*** ./dist/map/inputs/index.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Cartesian2WithInfos: () => (/* reexport safe */ _map_inputs_cartesian__WEBPACK_IMPORTED_MODULE_5__.Cartesian2WithInfos),
/* harmony export */   InputControllerBase: () => (/* reexport safe */ _map_inputs_controller__WEBPACK_IMPORTED_MODULE_4__.InputControllerBase),
/* harmony export */   InputsNavigationTarget: () => (/* reexport safe */ _map_inputs_navigation__WEBPACK_IMPORTED_MODULE_2__.InputsNavigationTarget),
/* harmony export */   MouseInputController: () => (/* reexport safe */ _map_inputs_mouse__WEBPACK_IMPORTED_MODULE_1__.MouseInputController),
/* harmony export */   PointerController: () => (/* reexport safe */ _map_inputs_source__WEBPACK_IMPORTED_MODULE_6__.PointerController),
/* harmony export */   PointerInputController: () => (/* reexport safe */ _map_inputs_pointer__WEBPACK_IMPORTED_MODULE_3__.PointerInputController),
/* harmony export */   isSupportingTouch: () => (/* reexport safe */ _map_inputs_interfaces__WEBPACK_IMPORTED_MODULE_0__.isSupportingTouch)
/* harmony export */ });
/* harmony import */ var _map_inputs_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./map.inputs.interfaces */ "./dist/map/inputs/map.inputs.interfaces.js");
/* harmony import */ var _map_inputs_mouse__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./map.inputs.mouse */ "./dist/map/inputs/map.inputs.mouse.js");
/* harmony import */ var _map_inputs_navigation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./map.inputs.navigation */ "./dist/map/inputs/map.inputs.navigation.js");
/* harmony import */ var _map_inputs_pointer__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./map.inputs.pointer */ "./dist/map/inputs/map.inputs.pointer.js");
/* harmony import */ var _map_inputs_controller__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./map.inputs.controller */ "./dist/map/inputs/map.inputs.controller.js");
/* harmony import */ var _map_inputs_cartesian__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./map.inputs.cartesian */ "./dist/map/inputs/map.inputs.cartesian.js");
/* harmony import */ var _map_inputs_source__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./map.inputs.source */ "./dist/map/inputs/map.inputs.source.js");







//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/map/inputs/map.inputs.cartesian.js":
/*!*************************************************!*\
  !*** ./dist/map/inputs/map.inputs.cartesian.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Cartesian2WithInfos: () => (/* binding */ Cartesian2WithInfos)
/* harmony export */ });
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.cartesian.js");

class Cartesian2WithInfos extends _geometry__WEBPACK_IMPORTED_MODULE_0__.Cartesian2 {
    constructor(x, y, buttonIndex, pointerId) {
        super(x, y);
        this.x = x;
        this.y = y;
        this._buttonIndex = buttonIndex ?? -1;
        this._pointerId = pointerId;
    }
    get buttonIndex() {
        return this._buttonIndex;
    }
    get pointerId() {
        return this._pointerId;
    }
}
//# sourceMappingURL=map.inputs.cartesian.js.map

/***/ }),

/***/ "./dist/map/inputs/map.inputs.controller.js":
/*!**************************************************!*\
  !*** ./dist/map/inputs/map.inputs.controller.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InputControllerBase: () => (/* binding */ InputControllerBase)
/* harmony export */ });
class InputControllerBase {
    constructor(src, target) {
        this._src = src;
        this._target = target;
    }
    get target() {
        return this._target;
    }
    get source() {
        return this._src;
    }
    dispose() {
        this._detachControl(this._src);
    }
    _attachControl(src) { }
    _detachControl(src) { }
}
//# sourceMappingURL=map.inputs.controller.js.map

/***/ }),

/***/ "./dist/map/inputs/map.inputs.interfaces.js":
/*!**************************************************!*\
  !*** ./dist/map/inputs/map.inputs.interfaces.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isSupportingTouch: () => (/* binding */ isSupportingTouch)
/* harmony export */ });
function isSupportingTouch() {
    return window.matchMedia("(hover: none)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
//# sourceMappingURL=map.inputs.interfaces.js.map

/***/ }),

/***/ "./dist/map/inputs/map.inputs.mouse.js":
/*!*********************************************!*\
  !*** ./dist/map/inputs/map.inputs.mouse.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MouseInputController: () => (/* binding */ MouseInputController)
/* harmony export */ });
/* harmony import */ var _map_inputs_controller__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./map.inputs.controller */ "./dist/map/inputs/map.inputs.controller.js");

class MouseInputController extends _map_inputs_controller__WEBPACK_IMPORTED_MODULE_0__.InputControllerBase {
    constructor(src, target) {
        super(src, target);
        this._ctxMenu = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
        };
        this._mouseDown = ((ev) => {
            this.target?.onPointerDown(this.source, ev.clientX, ev.clientY, ev.button);
        }).bind(this);
        this._mouseMove = ((ev) => {
            this.target?.onPointerMove(this.source, ev.clientX, ev.clientY);
        }).bind(this);
        this._mouseUp = ((ev) => {
            this.target?.onPointerUp(this.source, ev.clientX, ev.clientY, ev.button);
        }).bind(this);
        this._wheel = ((ev) => {
            this.target?.onWheel(this.source, ev.deltaY);
        }).bind(this);
        this._pointerDown = (ev) => {
            const e = ev.target;
            if (e?.hasPointerCapture(ev.pointerId)) {
                e?.releasePointerCapture(ev.pointerId);
            }
        };
    }
    _attachControl(src) {
        src.addEventListener("contextmenu", this._ctxMenu);
        src.addEventListener("mousedown", this._mouseDown);
        src.addEventListener("mousemove", this._mouseMove);
        src.addEventListener("mouseup", this._mouseUp);
        src.addEventListener("wheel", this._wheel);
        src.addEventListener("pointerdown", this._pointerDown);
    }
    _detachControl(src) {
        src.removeEventListener("contextmenu", this._ctxMenu);
        src.removeEventListener("mousedown", this._mouseDown);
        src.removeEventListener("mousemove", this._mouseMove);
        src.removeEventListener("mouseup", this._mouseUp);
        src.removeEventListener("wheel", this._wheel);
        src.removeEventListener("pointerdown", this._pointerDown);
    }
}
//# sourceMappingURL=map.inputs.mouse.js.map

/***/ }),

/***/ "./dist/map/inputs/map.inputs.navigation.js":
/*!**************************************************!*\
  !*** ./dist/map/inputs/map.inputs.navigation.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InputsNavigationTarget: () => (/* binding */ InputsNavigationTarget)
/* harmony export */ });
class InputsNavigationTarget {
    constructor(target, zoomIncrement) {
        this._target = target;
        this._offsetX = 0;
        this._offsetY = 0;
        this._startX = 0;
        this._startY = 0;
        this._button = 0;
        this._isDragging = false;
        this._zoomIncrement = zoomIncrement ?? InputsNavigationTarget.DEFAULT_ZOOM_INCREMENT;
    }
    onPointerOver(src, x, y, id) { }
    onPointerLeave(src, x, y, id) { }
    onPointerCancel(src, x, y, id) { }
    onPointerGotCapture(src, x, y, id) { }
    onPointerLostCapture(src, x, y, id) { }
    get target() {
        return this._target;
    }
    get zoomIncrement() {
        return this._zoomIncrement;
    }
    set zoomIncrement(value) {
        this._zoomIncrement = value;
    }
    onWheel(src, delta) {
        delta = this._zoomIncrement ? (delta < 0 ? this._zoomIncrement : -this._zoomIncrement) : delta;
        this._target.zoomMap(delta);
    }
    onPointerMove(src, x, y, id) {
        if (this._isDragging) {
            const dx = x - this._offsetX;
            const dy = y - this._offsetY;
            this._offsetX += dx;
            this._offsetY += dy;
            this.onDrag(src, dx, dy, this._button);
        }
    }
    onPointerOut(src, x, y, id) {
    }
    onPointerDown(src, x, y, buttonIndex, id) {
        this._offsetX = this._startX = x;
        this._offsetY = this._startY = y;
        this._button = buttonIndex;
        this._isDragging = true;
        this.onBeginDrag(src, this._offsetX, this._offsetY, this._button);
    }
    onPointerUp(src, x, y, buttonIndex, id) {
        this._isDragging = false;
        const dx = x - this._offsetX;
        const dy = y - this._offsetY;
        this.onEndDrag(src, dx, dy, this._button);
    }
    onPointerClick(src, x, y, buttonIndex, id) { }
    onPointerEnter(src, x, y, id) { }
    onBeginDrag(src, dx, dy, buttonIndex, id) { }
    onDrag(src, dx, dy, buttonIndex, id) {
        switch (buttonIndex) {
            case 0: {
                this._target.translateUnitsMap(-dx, -dy);
                break;
            }
            case 2: {
                this._target.rotateMap(dx);
                break;
            }
        }
    }
    onEndDrag(src, dx, dy, buttonIndex, id) { }
}
InputsNavigationTarget.DEFAULT_ZOOM_INCREMENT = 0.1;
//# sourceMappingURL=map.inputs.navigation.js.map

/***/ }),

/***/ "./dist/map/inputs/map.inputs.pointer.js":
/*!***********************************************!*\
  !*** ./dist/map/inputs/map.inputs.pointer.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PointerInputController: () => (/* binding */ PointerInputController)
/* harmony export */ });
/* harmony import */ var _map_inputs_controller__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./map.inputs.controller */ "./dist/map/inputs/map.inputs.controller.js");

class PointerInputController extends _map_inputs_controller__WEBPACK_IMPORTED_MODULE_0__.InputControllerBase {
    constructor(src, target) {
        super(src, target);
        this._events = [];
        this._ctxMenu = this._onContextMenu.bind(this);
        this._over = this._onPointerOver.bind(this);
        this._enter = this._onPointerEnter.bind(this);
        this._leave = this._onPointerLeave.bind(this);
        this._out = this._onPointerOut.bind(this);
        this._down = this._onPointerDown.bind(this);
        this._up = this._onPointerUp.bind(this);
        this._move = this._onPointerMove.bind(this);
        this._cancel = this._onPointerCancel.bind(this);
        this._gotCapture = this._onGotCapture.bind(this);
        this._lostCapture = this._onLostCapture.bind(this);
        this._wheel = this._onWheel.bind(this);
        this._attachControl(src);
    }
    _attachControl(src) {
        src.addEventListener("contextmenu", this._ctxMenu);
        src.addEventListener("pointerover", this._over);
        src.addEventListener("pointerenter", this._enter);
        src.addEventListener("pointerleave", this._leave);
        src.addEventListener("pointerout", this._out);
        src.addEventListener("pointerdown", this._down);
        src.addEventListener("pointerup", this._up);
        src.addEventListener("pointermove", this._move);
        src.addEventListener("pointercancel", this._cancel);
        src.addEventListener("gotpointercapture", this._gotCapture);
        src.addEventListener("lostpointercapture", this._lostCapture);
        src.addEventListener("wheel", this._wheel);
    }
    _detachControl(src) {
        src.removeEventListener("contextmenu", this._ctxMenu);
        src.removeEventListener("pointerover", this._over);
        src.removeEventListener("pointerenter", this._enter);
        src.removeEventListener("pointerleave", this._leave);
        src.removeEventListener("pointerout", this._out);
        src.removeEventListener("pointerdown", this._down);
        src.removeEventListener("pointerup", this._up);
        src.removeEventListener("pointermove", this._move);
        src.removeEventListener("pointercancel", this._cancel);
        src.removeEventListener("gotpointercapture", this._gotCapture);
        src.removeEventListener("lostpointercapture", this._lostCapture);
        src.removeEventListener("wheel", this._wheel);
    }
    _onContextMenu(ev) {
        ev.preventDefault();
        ev.stopPropagation();
    }
    _onPointerOver(ev) {
        this.target?.onPointerOver(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onPointerEnter(ev) {
        this.target?.onPointerEnter(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onPointerLeave(ev) {
        this.target?.onPointerLeave(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onPointerOut(ev) {
        this.target?.onPointerOut(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onPointerDown(ev) {
        this.target?.onPointerDown(this.source, ev.clientX, ev.clientY, ev.button, ev.pointerId);
    }
    _onPointerUp(ev) {
        this.target?.onPointerUp(this.source, ev.clientX, ev.clientY, ev.button, ev.pointerId);
    }
    _onPointerMove(ev) {
        this.target?.onPointerMove(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onPointerCancel(ev) {
        this.target?.onPointerCancel(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onGotCapture(ev) {
        this.target?.onPointerGotCapture(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onLostCapture(ev) {
        this.target?.onPointerLostCapture(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }
    _onWheel(ev) {
        this.target?.onWheel(this.source, ev.deltaY);
    }
}
//# sourceMappingURL=map.inputs.pointer.js.map

/***/ }),

/***/ "./dist/map/inputs/map.inputs.source.js":
/*!**********************************************!*\
  !*** ./dist/map/inputs/map.inputs.source.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PointerController: () => (/* binding */ PointerController)
/* harmony export */ });
/* harmony import */ var _map_inputs_navigation__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./map.inputs.navigation */ "./dist/map/inputs/map.inputs.navigation.js");

class PointerController {
    constructor(src, target) {
        this._src = src;
        this._target = target instanceof _map_inputs_navigation__WEBPACK_IMPORTED_MODULE_0__.InputsNavigationTarget ? target : new _map_inputs_navigation__WEBPACK_IMPORTED_MODULE_0__.InputsNavigationTarget(target);
        this._attachControl(this._src);
    }
    dispose() {
        if (this._src) {
            this._detachControl(this._src);
        }
    }
    _attachControl(src) {
        this._moveObserver = src.onPointerMoveObservable.add(this._onPointerMove.bind(this));
        this._downObserver = src.onPointerDownObservable.add(this._onPointerDown.bind(this));
        this._upObserver = src.onPointerUpObservable.add(this._onPointerUp.bind(this));
        this._wheelObserver = src.onWheelObservable.add(this._onWheel.bind(this));
    }
    _detachControl(src) {
        if (this._moveObserver) {
            src.onPointerMoveObservable.remove(this._moveObserver);
        }
        if (this._downObserver) {
            src.onPointerDownObservable.remove(this._downObserver);
        }
        if (this._upObserver) {
            src.onPointerUpObservable.remove(this._upObserver);
        }
        if (this._wheelObserver) {
            src.onWheelObservable.remove(this._wheelObserver);
        }
    }
    _onPointerMove(v, e) {
        this._target?.onPointerMove(this._src, v.x, v.y, v.pointerId);
    }
    _onPointerDown(v, e) {
        this._target?.onPointerDown(this._src, v.x, v.y, v.buttonIndex ?? -1, v.pointerId);
    }
    _onPointerUp(v, e) {
        this._target?.onPointerUp(this._src, v.x, v.y, v.buttonIndex ?? -1, v.pointerId);
    }
    _onWheel(v, e) {
        this._target?.onWheel(this._src, v);
    }
}
//# sourceMappingURL=map.inputs.source.js.map

/***/ }),

/***/ "./dist/math/index.js":
/*!****************************!*\
  !*** ./dist/math/index.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractRange: () => (/* reexport safe */ _math__WEBPACK_IMPORTED_MODULE_0__.AbstractRange),
/* harmony export */   Angle: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Angle),
/* harmony export */   Current: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Current),
/* harmony export */   HSLColor: () => (/* reexport safe */ _math_color__WEBPACK_IMPORTED_MODULE_2__.HSLColor),
/* harmony export */   Length: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Length),
/* harmony export */   Luminosity: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Luminosity),
/* harmony export */   Mass: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Mass),
/* harmony export */   Power: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Power),
/* harmony export */   Quantity: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Quantity),
/* harmony export */   QuantityRange: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.QuantityRange),
/* harmony export */   RGBAColor: () => (/* reexport safe */ _math_color__WEBPACK_IMPORTED_MODULE_2__.RGBAColor),
/* harmony export */   Range: () => (/* reexport safe */ _math__WEBPACK_IMPORTED_MODULE_0__.Range),
/* harmony export */   Scalar: () => (/* reexport safe */ _math__WEBPACK_IMPORTED_MODULE_0__.Scalar),
/* harmony export */   Speed: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Speed),
/* harmony export */   Temperature: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Temperature),
/* harmony export */   Timespan: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Timespan),
/* harmony export */   Unit: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Unit),
/* harmony export */   Voltage: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Voltage),
/* harmony export */   Volume: () => (/* reexport safe */ _math_units__WEBPACK_IMPORTED_MODULE_1__.Volume)
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
/* harmony export */   HSLColor: () => (/* binding */ HSLColor),
/* harmony export */   RGBAColor: () => (/* binding */ RGBAColor)
/* harmony export */ });
/* harmony import */ var _math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./math */ "./dist/math/math.js");

class RGBAColor {
    static White() {
        return new RGBAColor(255, 255, 255);
    }
    static Black() {
        return new RGBAColor(0, 0, 0);
    }
    static LightGray() {
        return new RGBAColor(211, 211, 211);
    }
    static Gray() {
        return new RGBAColor(128, 128, 128);
    }
    static CoolSteelBlue() {
        return new RGBAColor(70, 130, 180);
    }
    static ElectricBlue() {
        return new RGBAColor(0, 191, 255);
    }
    static NeonBlue() {
        return new RGBAColor(77, 77, 255);
    }
    constructor(r, g, b, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    toHexString() {
        const intR = Math.round(this.r);
        const intG = Math.round(this.g);
        const intB = Math.round(this.b);
        return "#" + _math__WEBPACK_IMPORTED_MODULE_0__.Scalar.ToHex(intR) + _math__WEBPACK_IMPORTED_MODULE_0__.Scalar.ToHex(intG) + _math__WEBPACK_IMPORTED_MODULE_0__.Scalar.ToHex(intB);
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
/* harmony export */   AbstractRange: () => (/* binding */ AbstractRange),
/* harmony export */   Range: () => (/* binding */ Range),
/* harmony export */   Scalar: () => (/* binding */ Scalar)
/* harmony export */ });
class Scalar {
    static WithinEpsilon(a, b, epsilon = Scalar.EPSILON) {
        const num = a - b;
        return -epsilon <= num && num <= epsilon;
    }
    static Sign(value) {
        return value > 0 ? 1 : -1;
    }
    static Clamp(value, min, max) {
        if (min === void 0) {
            min = 0;
        }
        if (max === void 0) {
            max = 1;
        }
        return Math.min(max, Math.max(min, value));
    }
    static GetRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static ToHex(i) {
        const str = i.toString(16);
        if (i <= 15) {
            return ("0" + str).toUpperCase();
        }
        return str.toUpperCase();
    }
}
Scalar.EPSILON = 1.401298e-45;
Scalar.DEG2RAD = Math.PI / 180;
Scalar.RAD2DEG = 180 / Math.PI;
Scalar.INCH2METER = 0.0254;
Scalar.METER2INCH = 39.3701;
Scalar.PI = Math.PI;
Scalar.PI_2 = Math.PI / 2;
Scalar.PI_4 = Math.PI / 4;
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
    static Zero() {
        return new Range(0, 0);
    }
    static Max() {
        return new Range(Number.MIN_VALUE, Number.MAX_VALUE);
    }
    computeDelta(a, b) {
        return a && b ? b - a : Number.POSITIVE_INFINITY;
    }
    constructor(min, max) {
        super(min, max);
    }
    unionInPlace(min, max) {
        if (min instanceof Range) {
            this.unionInPlace(min.min, min.max);
            return;
        }
        this._min = Math.min(this._min, min);
        if (max !== undefined) {
            this._max = Math.max(this._max ?? max, max);
        }
    }
    clone() {
        return new Range(this._min, this._max);
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
/* harmony export */   Angle: () => (/* binding */ Angle),
/* harmony export */   Current: () => (/* binding */ Current),
/* harmony export */   Length: () => (/* binding */ Length),
/* harmony export */   Luminosity: () => (/* binding */ Luminosity),
/* harmony export */   Mass: () => (/* binding */ Mass),
/* harmony export */   Power: () => (/* binding */ Power),
/* harmony export */   Quantity: () => (/* binding */ Quantity),
/* harmony export */   QuantityRange: () => (/* binding */ QuantityRange),
/* harmony export */   Speed: () => (/* binding */ Speed),
/* harmony export */   Temperature: () => (/* binding */ Temperature),
/* harmony export */   Timespan: () => (/* binding */ Timespan),
/* harmony export */   Unit: () => (/* binding */ Unit),
/* harmony export */   Voltage: () => (/* binding */ Voltage),
/* harmony export */   Volume: () => (/* binding */ Volume)
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
    static Convert(value, from, to) {
        if (!from || !to || from === to) {
            return value;
        }
        if (from.converter && from.converter.accept(to)) {
            return from.converter.convert(value, to);
        }
        return value * (from.value / to.value);
    }
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
class Length extends Quantity {
    static ForParameter(value, defaultValue, defaultUnit) {
        return value ? new Length(value, defaultUnit) : new Length(defaultValue, defaultUnit);
    }
    unitForSymbol(str) {
        return Length.Units[str] || undefined;
    }
}
Length.Units = {
    ym: new Unit("yoctometer", "ym", 10e-24),
    zm: new Unit("zeptometer", "zm", 10e-21),
    am: new Unit("attometer", "am", 10e-18),
    fm: new Unit("femtometer", "fm", 10e-15),
    pm: new Unit("picometer", "pm", 10e-12),
    nm: new Unit("nanometer", "nm", 10e-9),
    mim: new Unit("micrometer", "mim", 10e-6),
    mm: new Unit("millimeter", "mm", 10e-3),
    cm: new Unit("centimeter", "cm", 10e-2),
    in: new Unit("inch", "in", 0.0254),
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
        return value ? new Length(value, defaultUnit) : new Length(defaultValue, defaultUnit);
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
/* harmony export */   TerrainGridOptions: () => (/* reexport safe */ _terrain_grid__WEBPACK_IMPORTED_MODULE_0__.TerrainGridOptions),
/* harmony export */   TerrainGridOptionsBuilder: () => (/* reexport safe */ _terrain_grid__WEBPACK_IMPORTED_MODULE_0__.TerrainGridOptionsBuilder),
/* harmony export */   TerrainNormalizedGridBuilder: () => (/* reexport safe */ _terrain_grid__WEBPACK_IMPORTED_MODULE_0__.TerrainNormalizedGridBuilder)
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
/* harmony export */   TerrainGridOptions: () => (/* binding */ TerrainGridOptions),
/* harmony export */   TerrainGridOptionsBuilder: () => (/* binding */ TerrainGridOptionsBuilder),
/* harmony export */   TerrainNormalizedGridBuilder: () => (/* binding */ TerrainNormalizedGridBuilder)
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
    withNormals(flag) {
        this._normals = flag;
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
            normals: this._normals,
            columns: this._cols || this._rows,
            rows: this._rows || this._cols,
            sx: this._sx,
            sy: this._sy,
            invertIndices: this._invertIndices,
            invertYZ: this._invertYZ,
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
        const normals = this._o?.normals ? [] : null;
        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);
        const x0 = -0.5 + ox * dx;
        const y0 = 0.5 + oy * dy;
        for (let row = 0; row < h; row++) {
            let v = row * dy;
            const y = (y0 - v) * sy;
            for (let column = 0; column < w; column++) {
                const u = column * dx;
                const x = (x0 + u) * sx;
                const z = this._o?.zInitializer ? this._o.zInitializer(column, row, w, h, ...params) : 0;
                if (this._o?.invertYZ)
                    positions.push(x, z, y);
                else
                    positions.push(x, y, z);
                if (uvs) {
                    const uv = this._o?.uvInitializer ? this._o.uvInitializer(column, row, w, h, ...params) : [u, v];
                    uvs.push(...uv);
                }
                if (normals) {
                    if (this._o?.invertYZ)
                        normals.push(0, 1, 0);
                    else
                        normals.push(0, 0, 1);
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
        data.normals = normals;
        return data;
    }
}
//# sourceMappingURL=terrain.grid.js.map

/***/ }),

/***/ "./dist/space/Mechanics/index.js":
/*!***************************************!*\
  !*** ./dist/space/Mechanics/index.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var _space_kepler__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.kepler */ "./dist/space/Mechanics/space.kepler.js");
/* harmony import */ var _space_celestialTracker__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./space.celestialTracker */ "./dist/space/Mechanics/space.celestialTracker.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/space/Mechanics/space.celestialTracker.js":
/*!********************************************************!*\
  !*** ./dist/space/Mechanics/space.celestialTracker.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CelestialTracker: () => (/* binding */ CelestialTracker),
/* harmony export */   EquatorialVector: () => (/* binding */ EquatorialVector),
/* harmony export */   HorizonVector: () => (/* binding */ HorizonVector),
/* harmony export */   JulianDate: () => (/* binding */ JulianDate),
/* harmony export */   MoonState: () => (/* binding */ MoonState),
/* harmony export */   SunTrajectoryConfig: () => (/* binding */ SunTrajectoryConfig)
/* harmony export */ });
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../math/math */ "./dist/math/math.js");

class HorizonVector {
    constructor(azimuth, altitude) {
        this.azimuth = azimuth;
        this.altitude = altitude;
    }
}
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
        return _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (280.16 + 360.9856235 * d) - lw;
    }
    static Declination(l, b) {
        return Math.asin(Math.sin(b) * CelestialTracker.EarthObliquity_Cos + Math.sin(l) * CelestialTracker.EarthObliquity_Sin * Math.cos(b));
    }
    static RightAscension(l, b) {
        return Math.atan2(Math.sin(l) * CelestialTracker.EarthObliquity_Cos - Math.tan(b) * CelestialTracker.EarthObliquity_Sin, Math.cos(l));
    }
    static EclipticLongitude(M) {
        const C = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
        const P = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 102.9372;
        return M + C + P + Math.PI;
    }
    static SolarMeanAnomaly(d) {
        return _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (357.5291 + 0.98560028 * d);
    }
    static SunCoords(d) {
        const M = CelestialTracker.SolarMeanAnomaly(d);
        const L = CelestialTracker.EclipticLongitude(M);
        return new EquatorialVector(CelestialTracker.RightAscension(L, 0), CelestialTracker.Declination(L, 0));
    }
    static GetSunTimes(date, lat, lng, height) {
        height = height || 0;
        const lw = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * -lng;
        const phi = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * lat;
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
            const h0 = (time.angle + dh) * _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
            const Jset = CelestialTracker._GetSetJ(h0, lw, phi, dec, n, M, L);
            const Jrise = Jnoon - (Jset - Jnoon);
            result[time.riseName] = JulianDate.ToDate(Jrise);
            result[time.setName] = JulianDate.ToDate(Jset);
        }
        return result;
    }
    static GetSunPosition(date, lat, lon) {
        const lw = -lon * _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const phi = lat * _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const d = JulianDate.FromDate(date).toDays();
        const c = CelestialTracker.SunCoords(d);
        const H = CelestialTracker.SiderealTime(d, lw) - c.rightAscension;
        return new HorizonVector(CelestialTracker.Azimuth(H, phi, c.declination), CelestialTracker.Altitude(H, phi, c.declination));
    }
    static _MoonCoords(d) {
        const L = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (218.316 + 13.176396 * d);
        const M = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (134.963 + 13.064993 * d);
        const F = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * (93.272 + 13.22935 * d);
        const l = L + _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 6.289 * Math.sin(M);
        const b = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 5.128 * Math.sin(F);
        const dt = 385001 - 20905 * Math.cos(M);
        const v = new EquatorialVector(CelestialTracker.RightAscension(l, b), CelestialTracker.Declination(l, b));
        v.distance = dt;
        return v;
    }
    static _AstroRefraction(h) {
        if (h < 0)
            h = 0;
        return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
    }
    static GetMoonPosition(date, lat, lon) {
        const lw = -lon * _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const phi = lat * _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
        const d = JulianDate.FromDate(date).toDays();
        const c = CelestialTracker._MoonCoords(d);
        const H = CelestialTracker.SiderealTime(d, lw) - c.rightAscension;
        let h = CelestialTracker.Altitude(H, phi, c.declination);
        const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.declination) - Math.sin(c.declination) * Math.cos(H));
        h = h + CelestialTracker._AstroRefraction(h);
        const v = new HorizonVector(CelestialTracker.Azimuth(H, phi, c.declination), h);
        v.distance = c.distance;
        v.parallacticAngle = pa;
        return v;
    }
    static _HoursLater(date, h) {
        return new Date(date.valueOf() + (h * JulianDate.DayMs) / 24);
    }
}
CelestialTracker.EarthObliquity = _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD * 23.4397;
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
CelestialTracker.GetMoonIllumination = function (date) {
    const d = JulianDate.FromDate(date).toDays();
    const s = CelestialTracker.SunCoords(d);
    const m = CelestialTracker._MoonCoords(d);
    const sdist = 149598000;
    const phi = Math.acos(Math.sin(s.declination) * Math.sin(m.declination) + Math.cos(s.declination) * Math.cos(m.declination) * Math.cos(s.rightAscension - m.rightAscension));
    const inc = Math.atan2(sdist * Math.sin(phi), m.distance - sdist * Math.cos(phi));
    const angle = Math.atan2(Math.cos(s.declination) * Math.sin(s.rightAscension - m.rightAscension), Math.sin(s.declination) * Math.cos(m.declination) - Math.cos(s.declination) * Math.sin(m.declination) * Math.cos(s.rightAscension - m.rightAscension));
    return new MoonState(1 + Math.cos(inc), 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI, angle);
};
CelestialTracker.GetMoonTimes = function (date, lat, lng, inUTC) {
    var t = new Date(date);
    if (inUTC)
        t.setUTCHours(0, 0, 0, 0);
    else
        t.setHours(0, 0, 0, 0);
    const hc = 0.133 * _math_math__WEBPACK_IMPORTED_MODULE_0__.Scalar.DEG2RAD;
    let h0 = CelestialTracker.GetMoonPosition(t, lat, lng).altitude - hc;
    let rise, set, ye;
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

/***/ }),

/***/ "./dist/space/Mechanics/space.kepler.js":
/*!**********************************************!*\
  !*** ./dist/space/Mechanics/space.kepler.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   KeplerOrbitBase: () => (/* binding */ KeplerOrbitBase)
/* harmony export */ });
/* harmony import */ var _math_math_units__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../math/math.units */ "./dist/math/math.units.js");

class KeplerOrbitBase {
    constructor(body, focus, semiMajorAxis, eccentricity = 0, periapsisTime = 0, inclination, ascendingNodeLongitude, periapsisAngle, period) {
        this._body = body;
        this._focus = focus;
        this._semiMajorAxis = new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(semiMajorAxis, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Ly);
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
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(v, this._semiMajorAxis.unit);
    }
    get periapsis() {
        const v = this.semiMajorAxis.value * (1.0 - this._eccentricity);
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(v, this._semiMajorAxis.unit);
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
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(v, this._semiMajorAxis.unit);
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
        return new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(Math.round(E * Math.pow(10, dp)) / Math.pow(10, dp));
    }
}
KeplerOrbitBase.DefaultDecimalPrecision = 5;
KeplerOrbitBase.DefaultIterationLimit = 30;
//# sourceMappingURL=space.kepler.js.map

/***/ }),

/***/ "./dist/space/index.js":
/*!*****************************!*\
  !*** ./dist/space/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony export */   MoonState: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.MoonState),
/* harmony export */   MorganKeenanClass: () => (/* reexport safe */ _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__.MorganKeenanClass),
/* harmony export */   SpectralClass: () => (/* reexport safe */ _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__.SpectralClass),
/* harmony export */   StarColor: () => (/* reexport safe */ _space_starColor__WEBPACK_IMPORTED_MODULE_3__.StarColor),
/* harmony export */   SunTrajectoryConfig: () => (/* reexport safe */ _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__.SunTrajectoryConfig)
/* harmony export */ });
/* harmony import */ var _space_axialTilt__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./space.axialTilt */ "./dist/space/space.axialTilt.js");
/* harmony import */ var _space_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./space.interfaces */ "./dist/space/space.interfaces.js");
/* harmony import */ var _space_spectralClass__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./space.spectralClass */ "./dist/space/space.spectralClass.js");
/* harmony import */ var _space_starColor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./space.starColor */ "./dist/space/space.starColor.js");
/* harmony import */ var _Mechanics_index__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Mechanics/index */ "./dist/space/Mechanics/index.js");





//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/space/space.axialTilt.js":
/*!***************************************!*\
  !*** ./dist/space/space.axialTilt.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AxialTilt: () => (/* binding */ AxialTilt)
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

/***/ }),

/***/ "./dist/space/space.spectralClass.js":
/*!*******************************************!*\
  !*** ./dist/space/space.spectralClass.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MorganKeenanClass: () => (/* binding */ MorganKeenanClass),
/* harmony export */   SpectralClass: () => (/* binding */ SpectralClass)
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
SpectralClass.O = new SpectralClass("O", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(60000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "blue", "blue", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(16, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(6.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 0.00003);
SpectralClass.B = new SpectralClass("B", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(10000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "blue white", "deep blue white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(2.1, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(16, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(6.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(25, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(30000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 0.13);
SpectralClass.A = new SpectralClass("A", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(7500, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(10000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "white", "blue white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(2.1, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(25, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "strong", 0.6);
SpectralClass.F = new SpectralClass("F", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(6000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(7500, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "yellow white", "white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.04, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.15, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.4, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(1.5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "medium", 3);
SpectralClass.G = new SpectralClass("G", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(5200, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(6000, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "yellow", "yello white", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(1.04, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.96, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(1.15, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(1.5, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "weak", 7.6);
SpectralClass.K = new SpectralClass("K", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(3700, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(5200, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "orange	pale", "yello orange", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.45, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.7, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.96, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.08, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.6, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "very weak", 12.1);
SpectralClass.M = new SpectralClass("M", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(2400, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature(3700, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Temperature.Units.k)), "red light", "orange red", new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.08, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass(0.45, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Mass.Units.Sm)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length(0.7, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Length.Units.Sr)), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.QuantityRange(new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun), new _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity(0.8, _math_math_units__WEBPACK_IMPORTED_MODULE_0__.Luminosity.Units.Lsun)), "very weak", 76.45);
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
/* harmony export */   ColorValue: () => (/* binding */ ColorValue),
/* harmony export */   StarColor: () => (/* binding */ StarColor)
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

/***/ "./dist/tiles/address/index.js":
/*!*************************************!*\
  !*** ./dist/tiles/address/index.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileAddress: () => (/* reexport safe */ _tiles_address__WEBPACK_IMPORTED_MODULE_0__.TileAddress)
/* harmony export */ });
/* harmony import */ var _tiles_address__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.address */ "./dist/tiles/address/tiles.address.js");

//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/address/tiles.address.js":
/*!*********************************************!*\
  !*** ./dist/tiles/address/tiles.address.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileAddress: () => (/* binding */ TileAddress)
/* harmony export */ });
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../math/math */ "./dist/math/math.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.bounds.js");


class TileAddress {
    static ToBounds(a, metrics) {
        const points = [metrics.getTileXYToPointXY(a.x, a.y), metrics.getTileXYToPointXY(a.x + 1, a.y + 1)];
        return _geometry__WEBPACK_IMPORTED_MODULE_0__.Bounds2.FromPoints(...points);
    }
    static IsEquals(a, b) {
        return a.x === b.x && a.y === b.y && a.levelOfDetail === b.levelOfDetail;
    }
    static IsValidAddress(a, metrics) {
        if (!TileAddress.IsValidLod(a.levelOfDetail, metrics)) {
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
    static AssertValidAddress(a, metrics) {
        if (!TileAddress.IsValidLod(a.levelOfDetail, metrics)) {
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
    static IsValidLod(lod, metrics) {
        return lod >= metrics.minLOD && lod <= metrics.maxLOD;
    }
    static ClampLod(levelOfDetail, metrics) {
        return _math_math__WEBPACK_IMPORTED_MODULE_1__.Scalar.Clamp(levelOfDetail, metrics.minLOD, metrics.maxLOD);
    }
    static ToParentKey(key) {
        return key && key.length > 1 ? key.substring(0, key.length - 1) : key;
    }
    static ToChildsKey(key) {
        key = key || "";
        return [key.slice() + "0", key.slice() + "1", key.slice() + "2", key.slice() + "3"];
    }
    static ToNeigborsKey(key) {
        return TileAddress.ToNeigborsXY(TileAddress.QuadKeyToTileXY(key)).map((a) => (a ? TileAddress.TileXYToQuadKey(a.x, a.y, a.levelOfDetail) : null));
    }
    static ToNeigborsXY(a) {
        const max = Math.pow(2, a.levelOfDetail);
        const n = [
            new TileAddress(a.x - 1, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x + 1, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x - 1, a.y, a.levelOfDetail),
            a,
            new TileAddress(a.x + 1, a.y, a.levelOfDetail),
            new TileAddress(a.x - 1, a.y + 1, a.levelOfDetail),
            new TileAddress(a.x, a.y + 1, a.levelOfDetail),
            new TileAddress(a.x + 1, a.y + 1, a.levelOfDetail),
        ];
        return n.map((ad) => (ad.x >= 0 && ad.y >= 0 && ad.x < max && ad.y < max ? ad : null));
    }
    static TileXYToQuadKey(x, y, levelOfDetail) {
        let quadKey = "";
        for (let i = levelOfDetail; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) != 0) {
                digit++;
            }
            if ((y & mask) != 0) {
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
    constructor(x, y, levelOfDetail) {
        this._x = x;
        this._y = y;
        this._lod = levelOfDetail;
    }
    get x() {
        return this._x;
    }
    set x(value) {
        if (this._x !== value) {
            this._x = value;
            this._k = undefined;
        }
    }
    get y() {
        return this._y;
    }
    set y(value) {
        if (this._y !== value) {
            this._y = value;
            this._k = undefined;
        }
    }
    get levelOfDetail() {
        return this._lod;
    }
    set levelOfDetail(value) {
        if (this._lod !== value) {
            this._lod = value;
            this._k = undefined;
        }
    }
    get quadkey() {
        if (!this._k) {
            this._k = TileAddress.TileXYToQuadKey(this.x, this.y, this.levelOfDetail);
        }
        return this._k;
    }
    clone() {
        return new TileAddress(this.x, this.y, this.levelOfDetail);
    }
    toString() {
        return `x:${this.x}, y:${this.y}, lod:${this.levelOfDetail}, k:${this.quadkey}`;
    }
}
//# sourceMappingURL=tiles.address.js.map

/***/ }),

/***/ "./dist/tiles/codecs/index.js":
/*!************************************!*\
  !*** ./dist/tiles/codecs/index.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BlobTileCodec: () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_1__.BlobTileCodec),
/* harmony export */   CanvasTileCodec: () => (/* reexport safe */ _tiles_codecs_canvas__WEBPACK_IMPORTED_MODULE_5__.CanvasTileCodec),
/* harmony export */   Cartesian4TileCodec: () => (/* reexport safe */ _tiles_codecs_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian4TileCodec),
/* harmony export */   Cartesian4TileCodecOptions: () => (/* reexport safe */ _tiles_codecs_cartesian__WEBPACK_IMPORTED_MODULE_3__.Cartesian4TileCodecOptions),
/* harmony export */   Float32TileCodec: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.Float32TileCodec),
/* harmony export */   Float32TileCodecOptions: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.Float32TileCodecOptions),
/* harmony export */   Float32TileCodecOptionsBuilder: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.Float32TileCodecOptionsBuilder),
/* harmony export */   ImageDataTileCodec: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageDataTileCodec),
/* harmony export */   ImageDataTileCodecOptions: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageDataTileCodecOptions),
/* harmony export */   ImageDataTileCodecOptionsBuilder: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageDataTileCodecOptionsBuilder),
/* harmony export */   ImageTileCodec: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec),
/* harmony export */   JsonTileCodec: () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_1__.JsonTileCodec),
/* harmony export */   MedianFilter: () => (/* reexport safe */ _tiles_codecs_filter__WEBPACK_IMPORTED_MODULE_4__.MedianFilter),
/* harmony export */   RGBATileCodec: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.RGBATileCodec),
/* harmony export */   RGBTileCodec: () => (/* reexport safe */ _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.RGBTileCodec),
/* harmony export */   TextTileCodec: () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_1__.TextTileCodec),
/* harmony export */   XmlDocumentTileCodec: () => (/* reexport safe */ _tiles_codecs__WEBPACK_IMPORTED_MODULE_1__.XmlDocumentTileCodec),
/* harmony export */   isFilter: () => (/* reexport safe */ _tiles_codecs_interfaces__WEBPACK_IMPORTED_MODULE_0__.isFilter)
/* harmony export */ });
/* harmony import */ var _tiles_codecs_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.codecs.interfaces */ "./dist/tiles/codecs/tiles.codecs.interfaces.js");
/* harmony import */ var _tiles_codecs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.codecs */ "./dist/tiles/codecs/tiles.codecs.js");
/* harmony import */ var _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.codecs.image */ "./dist/tiles/codecs/tiles.codecs.image.js");
/* harmony import */ var _tiles_codecs_cartesian__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./tiles.codecs.cartesian */ "./dist/tiles/codecs/tiles.codecs.cartesian.js");
/* harmony import */ var _tiles_codecs_filter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./tiles.codecs.filter */ "./dist/tiles/codecs/tiles.codecs.filter.js");
/* harmony import */ var _tiles_codecs_canvas__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./tiles.codecs.canvas */ "./dist/tiles/codecs/tiles.codecs.canvas.js");






//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/codecs/tiles.codecs.canvas.js":
/*!**************************************************!*\
  !*** ./dist/tiles/codecs/tiles.codecs.canvas.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CanvasTileCodec: () => (/* binding */ CanvasTileCodec)
/* harmony export */ });
class CanvasTileCodec {
    constructor(canvas) {
        this._canvas = canvas;
    }
    get width() {
        return this._canvas.width;
    }
    get height() {
        return this._canvas.height;
    }
    async decodeAsync(r) {
        if (r instanceof Response) {
            const data = await this._decodeDataAsync(r);
            if (data) {
                const workingContext = this._canvas?.getContext("2d", { willReadFrequently: true });
                if (!workingContext) {
                    throw new Error("Unable to get 2d context");
                }
                this._render(workingContext, data);
                const imgData = workingContext.getImageData(0, 0, this._canvas.width, this._canvas.height);
                return await createImageBitmap(imgData);
            }
        }
        return null;
    }
}
//# sourceMappingURL=tiles.codecs.canvas.js.map

/***/ }),

/***/ "./dist/tiles/codecs/tiles.codecs.cartesian.js":
/*!*****************************************************!*\
  !*** ./dist/tiles/codecs/tiles.codecs.cartesian.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Cartesian4TileCodec: () => (/* binding */ Cartesian4TileCodec),
/* harmony export */   Cartesian4TileCodecOptions: () => (/* binding */ Cartesian4TileCodecOptions)
/* harmony export */ });
/* harmony import */ var _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.codecs.image */ "./dist/tiles/codecs/tiles.codecs.image.js");

class Cartesian4TileCodecOptions extends _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_0__.ImageDataTileCodecOptions {
    constructor(p) {
        super(p);
    }
}
class Cartesian4TileCodec {
    constructor(pixelDecoder, options, canvas) {
        this.pixelDecoder = pixelDecoder;
        this._canvas = canvas;
        this._options = options;
    }
    async decodeAsync(r) {
        const imgData = await (this._canvas ? new _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_0__.ImageDataTileCodec(this._canvas, this._options) : _tiles_codecs_image__WEBPACK_IMPORTED_MODULE_0__.ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            const w = imgData.width;
            const h = imgData.height;
            const size = w * h;
            const pixelSize = pixels.length / size;
            const stride = imgData.width * pixelSize;
            const values = this._buildArray(size);
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
    _buildArray(size) {
        const a = new Array(size);
        if (this._options?.factory) {
            for (let i = 0; i < size; i++) {
                a[i] = this._options.factory();
            }
        }
        return a;
    }
}
//# sourceMappingURL=tiles.codecs.cartesian.js.map

/***/ }),

/***/ "./dist/tiles/codecs/tiles.codecs.filter.js":
/*!**************************************************!*\
  !*** ./dist/tiles/codecs/tiles.codecs.filter.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MedianFilter: () => (/* binding */ MedianFilter)
/* harmony export */ });
class MedianFilter {
    constructor(_windowSize = 5, _threshold = 50) {
        this._windowSize = _windowSize;
        this._threshold = _threshold;
        if (_windowSize % 2 === 0) {
            throw new Error("Window size must be odd.");
        }
    }
    apply(values, x, y, width, height) {
        const edge = Math.floor(this._windowSize / 2);
        const result = new Float32Array(values.length);
        values.copyWithin(0, 0);
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const window = [];
                for (let wi = Math.max(-edge, -i); wi <= Math.min(edge, height - 1 - i); wi++) {
                    for (let wj = Math.max(-edge, -j); wj <= Math.min(edge, width - 1 - j); wj++) {
                        const index = (i + wi) * width + (j + wj);
                        window.push(values[index]);
                    }
                }
                window.sort((a, b) => a - b);
                const median = window[Math.floor(window.length / 2)];
                const currentIndex = i * width + j;
                const currentValue = values[currentIndex];
                if (Math.abs(currentValue - median) > this._threshold) {
                    result[currentIndex] = median;
                }
                else {
                    result[currentIndex] = currentValue;
                }
            }
        }
        return result;
    }
}
MedianFilter.Shared = new MedianFilter();
//# sourceMappingURL=tiles.codecs.filter.js.map

/***/ }),

/***/ "./dist/tiles/codecs/tiles.codecs.image.js":
/*!*************************************************!*\
  !*** ./dist/tiles/codecs/tiles.codecs.image.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Float32TileCodec: () => (/* binding */ Float32TileCodec),
/* harmony export */   Float32TileCodecOptions: () => (/* binding */ Float32TileCodecOptions),
/* harmony export */   Float32TileCodecOptionsBuilder: () => (/* binding */ Float32TileCodecOptionsBuilder),
/* harmony export */   ImageDataTileCodec: () => (/* binding */ ImageDataTileCodec),
/* harmony export */   ImageDataTileCodecOptions: () => (/* binding */ ImageDataTileCodecOptions),
/* harmony export */   ImageDataTileCodecOptionsBuilder: () => (/* binding */ ImageDataTileCodecOptionsBuilder),
/* harmony export */   ImageTileCodec: () => (/* binding */ ImageTileCodec),
/* harmony export */   RGBATileCodec: () => (/* binding */ RGBATileCodec),
/* harmony export */   RGBTileCodec: () => (/* binding */ RGBTileCodec)
/* harmony export */ });
/* harmony import */ var _geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geometry/geometry.interfaces */ "./dist/geometry/geometry.interfaces.js");

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
            const w = image.width - (insets[_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side.left] + insets[_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side.right]);
            const h = image.height - (insets[_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side.top] + insets[_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side.bottom]);
            const workingCanvas = this._canvas || ImageDataTileCodec.CreateCanvas(w, h);
            if (!workingCanvas) {
                throw new Error("Unable to create 2d canvas");
            }
            const workingContext = workingCanvas.getContext("2d", { willReadFrequently: true });
            if (!workingContext) {
                throw new Error("Unable to get 2d context");
            }
            workingContext.clearRect(0, 0, w, h);
            const sx = insets[_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side.left];
            const sy = insets[_geometry_geometry_interfaces__WEBPACK_IMPORTED_MODULE_0__.Side.top];
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
            if (this._options?.filter) {
                return this._options.filter.apply(values, 0, 0, w, h);
            }
            return values;
        }
        return null;
    }
}
//# sourceMappingURL=tiles.codecs.image.js.map

/***/ }),

/***/ "./dist/tiles/codecs/tiles.codecs.interfaces.js":
/*!******************************************************!*\
  !*** ./dist/tiles/codecs/tiles.codecs.interfaces.js ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isFilter: () => (/* binding */ isFilter)
/* harmony export */ });
function isFilter(f) {
    return f && typeof f.apply === "function";
}
//# sourceMappingURL=tiles.codecs.interfaces.js.map

/***/ }),

/***/ "./dist/tiles/codecs/tiles.codecs.js":
/*!*******************************************!*\
  !*** ./dist/tiles/codecs/tiles.codecs.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BlobTileCodec: () => (/* binding */ BlobTileCodec),
/* harmony export */   JsonTileCodec: () => (/* binding */ JsonTileCodec),
/* harmony export */   TextTileCodec: () => (/* binding */ TextTileCodec),
/* harmony export */   XmlDocumentTileCodec: () => (/* binding */ XmlDocumentTileCodec)
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

/***/ "./dist/tiles/display/index.js":
/*!*************************************!*\
  !*** ./dist/tiles/display/index.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Display: () => (/* reexport safe */ _tiles_display__WEBPACK_IMPORTED_MODULE_0__.Display)
/* harmony export */ });
/* harmony import */ var _tiles_display__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.display */ "./dist/tiles/display/tiles.display.js");

//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/display/tiles.display.js":
/*!*********************************************!*\
  !*** ./dist/tiles/display/tiles.display.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Display: () => (/* binding */ Display)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../events */ "./dist/events/events.observable.js");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../events */ "./dist/events/events.args.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.size.js");


class Display {
    get propertyChangedObservable() {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new _events__WEBPACK_IMPORTED_MODULE_0__.Observable();
        }
        return this._propertyChangedObservable;
    }
    constructor(resolution) {
        this._resolution = _geometry__WEBPACK_IMPORTED_MODULE_1__.Size3.FromSize(resolution);
    }
    get resolution() {
        return this._resolution;
    }
    resize(width, height, thickness) {
        if (this._resolution.width != width || this._resolution.height != height || this._resolution.thickness != thickness) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const old = this._resolution;
                this._resolution = new _geometry__WEBPACK_IMPORTED_MODULE_1__.Size3(width, height, thickness ?? this._resolution.thickness);
                this._propertyChangedObservable.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_2__.PropertyChangedEventArgs(this, old, this._resolution, "resolution"));
                return;
            }
            this._resolution.width = width;
            this._resolution.height = height;
            if (thickness) {
                this._resolution.thickness = thickness;
            }
        }
    }
    dispose() {
        this._propertyChangedObservable?.clear();
    }
}
//# sourceMappingURL=tiles.display.js.map

/***/ }),

/***/ "./dist/tiles/geography/index.js":
/*!***************************************!*\
  !*** ./dist/tiles/geography/index.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EPSG3857: () => (/* reexport safe */ _tiles_geography_EPSG3857__WEBPACK_IMPORTED_MODULE_0__.EPSG3857)
/* harmony export */ });
/* harmony import */ var _tiles_geography_EPSG3857__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.geography.EPSG3857 */ "./dist/tiles/geography/tiles.geography.EPSG3857.js");

//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/geography/tiles.geography.EPSG3857.js":
/*!**********************************************************!*\
  !*** ./dist/tiles/geography/tiles.geography.EPSG3857.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EPSG3857: () => (/* binding */ EPSG3857)
/* harmony export */ });
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../geodesy/geodesy.ellipsoid */ "./dist/geodesy/geodesy.ellipsoid.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../math/math */ "./dist/math/math.js");



class EPSG3857 extends _tiles_metrics__WEBPACK_IMPORTED_MODULE_0__.AbstractTileMetrics {
    constructor(options, ellipsoid) {
        super(options);
        this._ellipsoid = ellipsoid || _geodesy_geodesy_ellipsoid__WEBPACK_IMPORTED_MODULE_1__.Ellipsoid.WGS84;
    }
    groundResolution(latitude, levelOfDetail) {
        latitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        return (Math.cos(latitude * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD) * 2 * Math.PI * this._ellipsoid.semiMajorAxis) / this.mapSize(levelOfDetail);
    }
    getLatLonToTileXYToRef(latitude, longitude, levelOfDetail, tileXY) {
        if (!tileXY)
            return;
        const t = tileXY;
        latitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);
        const n = Math.pow(2, levelOfDetail);
        const x = Math.floor(((longitude + 180) / 360) * n);
        const lat_rad = latitude * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD;
        const y = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);
        t.x = x;
        t.y = y;
    }
    getTileXYToLatLonToRef(x, y, levelOfDetail, loc) {
        if (!loc)
            return;
        const l = loc;
        let n = Math.pow(2, levelOfDetail);
        const lon = -180 + (x / n) * 360;
        n = Math.PI - (2 * Math.PI * y) / n;
        const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
        l.lat = lat;
        l.lon = lon;
    }
    getLatLonToPointXYToRef(latitude, longitude, levelOfDetail, pointXY) {
        if (!pointXY)
            return;
        const p = pointXY;
        latitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);
        const x = (longitude + 180) / 360;
        const sinLatitude = Math.sin(latitude * _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.DEG2RAD);
        const y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);
        const mapSize = this.mapSize(levelOfDetail);
        p.x = Math.ceil(_math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(x * mapSize, 0, mapSize - 1));
        p.y = Math.ceil(_math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(y * mapSize, 0, mapSize - 1));
    }
    getPointXYToLatLonToRef(pointX, pointY, levelOfDetail, latLon) {
        if (!latLon)
            return;
        const g = latLon;
        const mapSize = this.mapSize(levelOfDetail);
        const x = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(pointX, 0, mapSize - 1) / mapSize - 0.5;
        const y = 0.5 - _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.Clamp(pointY, 0, mapSize - 1) / mapSize;
        g.lat = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
        g.lon = 360 * x;
    }
    getTileXYToPointXYToRef(tileX, tileY, pointXY) {
        if (!pointXY)
            return;
        const p = pointXY;
        const s = this.tileSize;
        p.x = tileX * s;
        p.y = tileY * s;
    }
    getPointXYToTileXYToRef(pointX, pointY, tileXY) {
        if (!tileXY)
            return;
        const t = tileXY;
        const s = this.tileSize;
        t.x = Math.floor(pointX / s);
        t.y = Math.floor(pointY / s);
    }
}
EPSG3857.Shared = new EPSG3857();
//# sourceMappingURL=tiles.geography.EPSG3857.js.map

/***/ }),

/***/ "./dist/tiles/index.js":
/*!*****************************!*\
  !*** ./dist/tiles/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractTileMetrics: () => (/* reexport safe */ _tiles_metrics__WEBPACK_IMPORTED_MODULE_11__.AbstractTileMetrics),
/* harmony export */   AbstractTileProvider: () => (/* reexport safe */ _providers_index__WEBPACK_IMPORTED_MODULE_5__.AbstractTileProvider),
/* harmony export */   BlobTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.BlobTileCodec),
/* harmony export */   CanvasTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.CanvasTileCodec),
/* harmony export */   Cartesian4TileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.Cartesian4TileCodec),
/* harmony export */   Cartesian4TileCodecOptions: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.Cartesian4TileCodecOptions),
/* harmony export */   CellCoordinateReference: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.CellCoordinateReference),
/* harmony export */   Display: () => (/* reexport safe */ _display_index__WEBPACK_IMPORTED_MODULE_7__.Display),
/* harmony export */   EPSG3857: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_8__.EPSG3857),
/* harmony export */   FetchError: () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_12__.FetchError),
/* harmony export */   FetchResult: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.FetchResult),
/* harmony export */   Float32Layer: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.Float32Layer),
/* harmony export */   Float32TileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.Float32TileCodec),
/* harmony export */   Float32TileCodecOptions: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.Float32TileCodecOptions),
/* harmony export */   Float32TileCodecOptionsBuilder: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.Float32TileCodecOptionsBuilder),
/* harmony export */   Google: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_0__.Google),
/* harmony export */   GoogleMap2DLayerCode: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_0__.GoogleMap2DLayerCode),
/* harmony export */   GoogleMap2DUrlBuilder: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_0__.GoogleMap2DUrlBuilder),
/* harmony export */   ImageDataTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.ImageDataTileCodec),
/* harmony export */   ImageDataTileCodecOptions: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.ImageDataTileCodecOptions),
/* harmony export */   ImageDataTileCodecOptionsBuilder: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.ImageDataTileCodecOptionsBuilder),
/* harmony export */   ImageLayer: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.ImageLayer),
/* harmony export */   ImageTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.ImageTileCodec),
/* harmony export */   IsArrayOfTile: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsArrayOfTile),
/* harmony export */   IsArrayOfTileAddress: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsArrayOfTileAddress),
/* harmony export */   IsDrawableTileMapLayer: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.IsDrawableTileMapLayer),
/* harmony export */   IsTargetBlock: () => (/* reexport safe */ _pipeline_index__WEBPACK_IMPORTED_MODULE_2__.IsTargetBlock),
/* harmony export */   IsTile: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsTile),
/* harmony export */   IsTileAddress: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsTileAddress),
/* harmony export */   IsTileCollection: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsTileCollection),
/* harmony export */   IsTileDatasource: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsTileDatasource),
/* harmony export */   IsTileMapLayer: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.IsTileMapLayer),
/* harmony export */   IsTileMapLayerContainerProxy: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.IsTileMapLayerContainerProxy),
/* harmony export */   IsTileMapLayerProxy: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.IsTileMapLayerProxy),
/* harmony export */   IsTileMetricsProvider: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsTileMetricsProvider),
/* harmony export */   IsTileMipMapping: () => (/* reexport safe */ _pipeline_index__WEBPACK_IMPORTED_MODULE_2__.IsTileMipMapping),
/* harmony export */   IsTileNavigationApi: () => (/* reexport safe */ _navigation_index__WEBPACK_IMPORTED_MODULE_3__.IsTileNavigationApi),
/* harmony export */   IsTileNavigationState: () => (/* reexport safe */ _navigation_index__WEBPACK_IMPORTED_MODULE_3__.IsTileNavigationState),
/* harmony export */   IsTileSystemBounds: () => (/* reexport safe */ _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__.IsTileSystemBounds),
/* harmony export */   JsonTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.JsonTileCodec),
/* harmony export */   MapZen: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_0__.MapZen),
/* harmony export */   MapZenDemUrlBuilder: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_0__.MapZenDemUrlBuilder),
/* harmony export */   MapZenNormalsDecoder: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_0__.MapZenNormalsDecoder),
/* harmony export */   MapzenAltitudeDecoder: () => (/* reexport safe */ _vendors_index__WEBPACK_IMPORTED_MODULE_0__.MapzenAltitudeDecoder),
/* harmony export */   MedianFilter: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.MedianFilter),
/* harmony export */   RGBATileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.RGBATileCodec),
/* harmony export */   RGBTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.RGBTileCodec),
/* harmony export */   ShapeCollection: () => (/* reexport safe */ _vector_index__WEBPACK_IMPORTED_MODULE_9__.ShapeCollection),
/* harmony export */   ShapeCollectionEventArgs: () => (/* reexport safe */ _vector_index__WEBPACK_IMPORTED_MODULE_9__.ShapeCollectionEventArgs),
/* harmony export */   TextTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.TextTileCodec),
/* harmony export */   Tile: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_13__.Tile),
/* harmony export */   TileAddress: () => (/* reexport safe */ _address_index__WEBPACK_IMPORTED_MODULE_6__.TileAddress),
/* harmony export */   TileCollection: () => (/* reexport safe */ _tiles_collection__WEBPACK_IMPORTED_MODULE_15__.TileCollection),
/* harmony export */   TileContentProvider: () => (/* reexport safe */ _providers_index__WEBPACK_IMPORTED_MODULE_5__.TileContentProvider),
/* harmony export */   TileMapBase: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.TileMapBase),
/* harmony export */   TileMapLayer: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.TileMapLayer),
/* harmony export */   TileMapLayerView: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.TileMapLayerView),
/* harmony export */   TileMapVectorLayer: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.TileMapVectorLayer),
/* harmony export */   TileNavigationState: () => (/* reexport safe */ _navigation_index__WEBPACK_IMPORTED_MODULE_3__.TileNavigationState),
/* harmony export */   TileNavigationStateSynchronizer: () => (/* reexport safe */ _navigation_index__WEBPACK_IMPORTED_MODULE_3__.TileNavigationStateSynchronizer),
/* harmony export */   TilePipelineLink: () => (/* reexport safe */ _pipeline_index__WEBPACK_IMPORTED_MODULE_2__.TilePipelineLink),
/* harmony export */   TileProvider: () => (/* reexport safe */ _providers_index__WEBPACK_IMPORTED_MODULE_5__.TileProvider),
/* harmony export */   TileSystemBounds: () => (/* reexport safe */ _tiles_system__WEBPACK_IMPORTED_MODULE_16__.TileSystemBounds),
/* harmony export */   TileVectorRenderer: () => (/* reexport safe */ _vector_index__WEBPACK_IMPORTED_MODULE_9__.TileVectorRenderer),
/* harmony export */   TileView: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_4__.TileView),
/* harmony export */   TileWebClient: () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_12__.TileWebClient),
/* harmony export */   TileWebClientOptions: () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_12__.TileWebClientOptions),
/* harmony export */   TileWebClientOptionsBuilder: () => (/* reexport safe */ _tiles_client__WEBPACK_IMPORTED_MODULE_12__.TileWebClientOptionsBuilder),
/* harmony export */   VectorTileGeomType: () => (/* reexport safe */ _vector_index__WEBPACK_IMPORTED_MODULE_9__.VectorTileGeomType),
/* harmony export */   WebTileUrlBuilder: () => (/* reexport safe */ _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_14__.WebTileUrlBuilder),
/* harmony export */   XmlDocumentTileCodec: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.XmlDocumentTileCodec),
/* harmony export */   hasNavigationApi: () => (/* reexport safe */ _navigation_index__WEBPACK_IMPORTED_MODULE_3__.hasNavigationApi),
/* harmony export */   hasNavigationState: () => (/* reexport safe */ _navigation_index__WEBPACK_IMPORTED_MODULE_3__.hasNavigationState),
/* harmony export */   hasTileSelectionContext: () => (/* reexport safe */ _pipeline_index__WEBPACK_IMPORTED_MODULE_2__.hasTileSelectionContext),
/* harmony export */   isFilter: () => (/* reexport safe */ _codecs_index__WEBPACK_IMPORTED_MODULE_1__.isFilter),
/* harmony export */   isViewProxy: () => (/* reexport safe */ _pipeline_index__WEBPACK_IMPORTED_MODULE_2__.isViewProxy)
/* harmony export */ });
/* harmony import */ var _vendors_index__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./vendors/index */ "./dist/tiles/vendors/index.js");
/* harmony import */ var _codecs_index__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./codecs/index */ "./dist/tiles/codecs/index.js");
/* harmony import */ var _pipeline_index__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./pipeline/index */ "./dist/tiles/pipeline/index.js");
/* harmony import */ var _navigation_index__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./navigation/index */ "./dist/tiles/navigation/index.js");
/* harmony import */ var _map_index__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./map/index */ "./dist/tiles/map/index.js");
/* harmony import */ var _providers_index__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./providers/index */ "./dist/tiles/providers/index.js");
/* harmony import */ var _address_index__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./address/index */ "./dist/tiles/address/index.js");
/* harmony import */ var _display_index__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./display/index */ "./dist/tiles/display/index.js");
/* harmony import */ var _geography_index__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./geography/index */ "./dist/tiles/geography/index.js");
/* harmony import */ var _vector_index__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./vector/index */ "./dist/tiles/vector/index.js");
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _tiles_metrics__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./tiles.metrics */ "./dist/tiles/tiles.metrics.js");
/* harmony import */ var _tiles_client__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./tiles.client */ "./dist/tiles/tiles.client.js");
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./tiles */ "./dist/tiles/tiles.js");
/* harmony import */ var _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./tiles.urlBuilder */ "./dist/tiles/tiles.urlBuilder.js");
/* harmony import */ var _tiles_collection__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./tiles.collection */ "./dist/tiles/tiles.collection.js");
/* harmony import */ var _tiles_system__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./tiles.system */ "./dist/tiles/tiles.system.js");

















//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/map/index.js":
/*!*********************************!*\
  !*** ./dist/tiles/map/index.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Float32Layer: () => (/* reexport safe */ _typed_index__WEBPACK_IMPORTED_MODULE_2__.Float32Layer),
/* harmony export */   ImageLayer: () => (/* reexport safe */ _typed_index__WEBPACK_IMPORTED_MODULE_2__.ImageLayer),
/* harmony export */   IsDrawableTileMapLayer: () => (/* reexport safe */ _tiles_map_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsDrawableTileMapLayer),
/* harmony export */   IsTileMapLayer: () => (/* reexport safe */ _tiles_map_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsTileMapLayer),
/* harmony export */   IsTileMapLayerContainerProxy: () => (/* reexport safe */ _tiles_map_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsTileMapLayerContainerProxy),
/* harmony export */   IsTileMapLayerProxy: () => (/* reexport safe */ _tiles_map_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsTileMapLayerProxy),
/* harmony export */   TileMapBase: () => (/* reexport safe */ _tiles_map__WEBPACK_IMPORTED_MODULE_0__.TileMapBase),
/* harmony export */   TileMapLayer: () => (/* reexport safe */ _tiles_map_layer__WEBPACK_IMPORTED_MODULE_3__.TileMapLayer),
/* harmony export */   TileMapLayerView: () => (/* reexport safe */ _tiles_map_layerView__WEBPACK_IMPORTED_MODULE_4__.TileMapLayerView),
/* harmony export */   TileMapVectorLayer: () => (/* reexport safe */ _typed_index__WEBPACK_IMPORTED_MODULE_2__.TileMapVectorLayer),
/* harmony export */   TileView: () => (/* reexport safe */ _tiles_map_view__WEBPACK_IMPORTED_MODULE_5__.TileView)
/* harmony export */ });
/* harmony import */ var _tiles_map__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.map */ "./dist/tiles/map/tiles.map.js");
/* harmony import */ var _tiles_map_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.map.interfaces */ "./dist/tiles/map/tiles.map.interfaces.js");
/* harmony import */ var _typed_index__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./typed/index */ "./dist/tiles/map/typed/index.js");
/* harmony import */ var _tiles_map_layer__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./tiles.map.layer */ "./dist/tiles/map/tiles.map.layer.js");
/* harmony import */ var _tiles_map_layerView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./tiles.map.layerView */ "./dist/tiles/map/tiles.map.layerView.js");
/* harmony import */ var _tiles_map_view__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./tiles.map.view */ "./dist/tiles/map/tiles.map.view.js");






//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/map/tiles.map.interfaces.js":
/*!************************************************!*\
  !*** ./dist/tiles/map/tiles.map.interfaces.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsDrawableTileMapLayer: () => (/* binding */ IsDrawableTileMapLayer),
/* harmony export */   IsTileMapLayer: () => (/* binding */ IsTileMapLayer),
/* harmony export */   IsTileMapLayerContainerProxy: () => (/* binding */ IsTileMapLayerContainerProxy),
/* harmony export */   IsTileMapLayerProxy: () => (/* binding */ IsTileMapLayerProxy)
/* harmony export */ });
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");

function IsDrawableTileMapLayer(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.drawFn !== undefined;
}
function IsTileMapLayer(b) {
    if (b === null || typeof b !== "object")
        return false;
    return (0,_tiles_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsTileMetricsProvider)(b) && b.provider !== undefined && b.addTo !== undefined;
}
function IsTileMapLayerProxy(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.layer !== undefined;
}
function IsTileMapLayerContainerProxy(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.layers !== undefined;
}
//# sourceMappingURL=tiles.map.interfaces.js.map

/***/ }),

/***/ "./dist/tiles/map/tiles.map.js":
/*!*************************************!*\
  !*** ./dist/tiles/map/tiles.map.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileMapBase: () => (/* binding */ TileMapBase)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../events */ "./dist/events/events.observable.js");
/* harmony import */ var _navigation__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../navigation */ "./dist/tiles/navigation/tiles.navigation.state.js");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../types */ "./dist/types.js");
/* harmony import */ var _pipeline__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../pipeline */ "./dist/tiles/pipeline/tiles.pipeline.interfaces.js");
/* harmony import */ var _validable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../validable */ "./dist/validable.js");
/* harmony import */ var _collections_orderedCollection__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../collections/orderedCollection */ "./dist/collections/orderedCollection.js");
/* harmony import */ var _tiles_map_layerView__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./tiles.map.layerView */ "./dist/tiles/map/tiles.map.layerView.js");
/* harmony import */ var _tiles_map_view__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.map.view */ "./dist/tiles/map/tiles.map.view.js");








class TileMapBase extends _validable__WEBPACK_IMPORTED_MODULE_0__.ValidableBase {
    constructor(display, nav, container) {
        super();
        this._layers = container ?? this._createLayerContainer() ?? this._createLayerContainerInternal();
        this._layerAddedObserver = this._layers.addedObservable.add(this._onLayerAdded.bind(this));
        this._layerRemovedObserver = this._layers.removedObservable.add(this._onLayerRemoved.bind(this));
        this._display = display;
        this._bindDisplay(this._display);
        this._navigation = nav ?? this._buildNavigationState() ?? new _navigation__WEBPACK_IMPORTED_MODULE_1__.TileNavigationState();
        this._bindNavigation(this._navigation);
        this._view = this._buildView() ?? new _tiles_map_view__WEBPACK_IMPORTED_MODULE_2__.TileView();
        this._layerViews = this._createLayerViewContainer(this._layers) ?? this._createLayerViewContainerInternal(this._layers);
        this._layerViewAddedObserver = this._layerViews.addedObservable.add(this._onLayerViewAdded.bind(this));
        this._layerViewRemovedObserver = this._layerViews.removedObservable.add(this._onLayerViewRemoved.bind(this));
    }
    get layers() {
        return this._layers;
    }
    get layerViews() {
        return this._layerViews;
    }
    get propertyChangedObservable() {
        if (!this._propertyChangedObservable)
            this._propertyChangedObservable = new _events__WEBPACK_IMPORTED_MODULE_3__.Observable();
        return this._propertyChangedObservable;
    }
    get display() {
        return this._display;
    }
    get navigation() {
        return this._navigation;
    }
    get view() {
        return this._view;
    }
    dispose() {
        super.dispose();
        this._navigationUpdatedObserver?.disconnect();
        this._displayPropertyObserver?.disconnect();
        this._layerAddedObserver?.disconnect();
        this._layerRemovedObserver?.disconnect();
        this._layerViewAddedObserver?.disconnect();
        this._layerViewRemovedObserver?.disconnect();
    }
    setViewMap(center, zoom, rotation) {
        this._navigation.setViewMap(center, zoom, rotation);
        return this;
    }
    zoomMap(delta) {
        this._navigation.zoomMap(delta);
        return this;
    }
    zoomInMap(delta) {
        this._navigation.zoomInMap(delta);
        return this;
    }
    zoomOutMap(delta) {
        this._navigation.zoomOutMap(delta);
        return this;
    }
    translateUnitsMap(tx, ty, metrics) {
        this._navigation.translateUnitsMap(tx, ty, metrics);
        return this;
    }
    translateMap(lat, lon) {
        this._navigation.translateMap(lat, lon);
        return this;
    }
    rotateMap(r) {
        this._navigation.rotateMap(r);
        return this;
    }
    get isValid() {
        return super.isValid && this._layers.isValid;
    }
    _doValidate() {
        for (const l of this._layerViews) {
            const layer = l.layer;
            if ((0,_types__WEBPACK_IMPORTED_MODULE_4__.isValidable)(l)) {
                l.validate();
            }
            if ((0,_pipeline__WEBPACK_IMPORTED_MODULE_5__.hasTileSelectionContext)(l)) {
                const offset = layer.zoomOffset ?? 0;
                const n = offset
                    ? new _navigation__WEBPACK_IMPORTED_MODULE_1__.TileNavigationState(this.navigation.center, this.navigation.lod + offset, this.navigation.azimuth?.value, this.navigation.bounds)
                    : this.navigation;
                l.setContext(n, this.display, layer.metrics);
            }
        }
    }
    _onLayerAdded(eventData, eventstate) {
        this._layerViews.add(...eventData.map((l) => this._createLayerView(l)));
        this.invalidate();
    }
    _onLayerRemoved(eventData, eventstate) {
        const toRemove = Array.from(this._layerViews.get((v) => eventData.includes(v.layer)));
        if (toRemove?.length) {
            this._layerViews.remove(...toRemove);
            this.invalidate();
        }
    }
    _onLayerViewAdded(eventData, eventstate) { }
    _onLayerViewRemoved(eventData, eventstate) { }
    _onNavigationUpdatedInternal(event, state) {
        if (event) {
            this.invalidate();
            this._onNavigationUpdated(this._navigation);
        }
    }
    _onDisplayPropertyChanged(event, state) {
        switch (event.propertyName) {
            case "size": {
                this.invalidate();
                this._onDisplayResized(event.source);
                break;
            }
            default: {
                break;
            }
        }
    }
    _bindDisplay(display) {
        if (display) {
            this._display = display;
            this._displayPropertyObserver = this._display?.propertyChangedObservable?.add(this._onDisplayPropertyChanged.bind(this));
        }
        this.invalidate();
        this._onDisplayBinded(display);
    }
    _bindNavigation(nav) {
        this._navigationUpdatedObserver?.disconnect();
        if (nav) {
            this._navigationUpdatedObserver = this._navigation.validationObservable?.add(this._onNavigationUpdatedInternal.bind(this));
        }
        this.invalidate();
        this._onNavigationBinded(nav);
    }
    _createLayerContainer() {
        return this._createLayerContainerInternal();
    }
    _createLayerViewContainer(layers) {
        return this._createLayerViewContainerInternal(layers);
    }
    _createLayerView(layer) {
        return this._createLayerViewInternal(layer);
    }
    _onDisplayUnbinded(display) {
    }
    _onDisplayBinded(display) {
    }
    _onNavigationUnbinded(nav) {
    }
    _onNavigationBinded(nav) {
    }
    _onNavigationUpdated(nav) {
    }
    _onDisplayResized(display) {
    }
    _onDisplayTranslated(display) {
    }
    _buildNavigationState() {
        return new _navigation__WEBPACK_IMPORTED_MODULE_1__.TileNavigationState();
    }
    _buildView() {
        return new _tiles_map_view__WEBPACK_IMPORTED_MODULE_2__.TileView();
    }
    _createLayerContainerInternal() {
        return new _collections_orderedCollection__WEBPACK_IMPORTED_MODULE_6__.OrderedCollection();
    }
    _createLayerViewContainerInternal(layers) {
        return new _collections_orderedCollection__WEBPACK_IMPORTED_MODULE_6__.OrderedCollection(...Array.from(this._layers).map((l) => this._createLayerView(l) ?? this._createLayerViewInternal(l)));
    }
    _createLayerViewInternal(layer) {
        return new _tiles_map_layerView__WEBPACK_IMPORTED_MODULE_7__.TileMapLayerView(layer, this._display, this._navigation, this._view);
    }
}
//# sourceMappingURL=tiles.map.js.map

/***/ }),

/***/ "./dist/tiles/map/tiles.map.layer.js":
/*!*******************************************!*\
  !*** ./dist/tiles/map/tiles.map.layer.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileMapLayer: () => (/* binding */ TileMapLayer)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../events */ "./dist/events/events.observable.js");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../events */ "./dist/events/events.args.js");
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _tiles_map_interfaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./tiles.map.interfaces */ "./dist/tiles/map/tiles.map.interfaces.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../utils */ "./dist/utils/runtime.js");
/* harmony import */ var _providers__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../providers */ "./dist/tiles/providers/tiles.provider.content.js");





class TileMapLayer {
    constructor(name, provider, options, enabled) {
        (0,_utils__WEBPACK_IMPORTED_MODULE_0__.Assert)(name !== undefined && name !== null && name !== "", "Invalid layer name.");
        (0,_utils__WEBPACK_IMPORTED_MODULE_0__.Assert)(provider !== undefined && name !== null, "Invalid provider or datasource");
        this._name = name;
        this._provider = (0,_tiles_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsTileDatasource)(provider) ? this._buildProvider(provider) : provider;
        this._weight = options?.weight ?? -1;
        this._zoomOffset = options?.zoomOffset ?? 0;
        this._attribution = options?.attribution;
        this._draw = options?.drawFn;
        this._drawTarget = options?.drawTarget ?? this;
        this._enabled = enabled ?? true;
    }
    get metrics() {
        return this._provider.metrics;
    }
    get provider() {
        return this._provider;
    }
    get drawFn() {
        return this._draw;
    }
    get drawTarget() {
        return this._drawTarget;
    }
    get propertyChangedObservable() {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new _events__WEBPACK_IMPORTED_MODULE_2__.Observable();
        }
        return this._propertyChangedObservable;
    }
    get weightChangedObservable() {
        if (!this._weightChangedObservable) {
            this._weightChangedObservable = new _events__WEBPACK_IMPORTED_MODULE_2__.Observable();
        }
        return this._weightChangedObservable;
    }
    get name() {
        return this._name;
    }
    get weight() {
        return this._weight;
    }
    set weight(zindex) {
        if (this._weight !== zindex) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._weight;
                this._weight = zindex;
                const args = new _events__WEBPACK_IMPORTED_MODULE_3__.PropertyChangedEventArgs(this, oldValue, this._weight, "weight");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            if (this._weightChangedObservable && this._weightChangedObservable.hasObservers()) {
                this._weightChangedObservable.notifyObservers(this, -1, this, this);
            }
            this._weight = zindex;
        }
    }
    get zoomOffset() {
        return this._zoomOffset ?? 0;
    }
    set zoomOffset(zoomOffset) {
        if (this._zoomOffset !== zoomOffset) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._zoomOffset;
                this._zoomOffset = zoomOffset;
                const args = new _events__WEBPACK_IMPORTED_MODULE_3__.PropertyChangedEventArgs(this, oldValue, this._zoomOffset, "zoomOffset");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._zoomOffset = zoomOffset;
        }
    }
    get attribution() {
        return this._attribution;
    }
    set attribution(attribution) {
        if (this._attribution !== attribution) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._attribution;
                this._attribution = attribution;
                const args = new _events__WEBPACK_IMPORTED_MODULE_3__.PropertyChangedEventArgs(this, oldValue, this._attribution, "attribution");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._attribution = attribution;
        }
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(enabled) {
        if (this._enabled !== enabled) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._enabled;
                this._enabled = enabled;
                const args = new _events__WEBPACK_IMPORTED_MODULE_3__.PropertyChangedEventArgs(this, oldValue, this._enabled, "enabled");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._enabled = enabled;
        }
    }
    addTo(map) {
        if (map) {
            if ((0,_tiles_map_interfaces__WEBPACK_IMPORTED_MODULE_4__.IsTileMapLayerContainerProxy)(map)) {
                map = map.layers;
            }
            map?.add(this);
        }
        return this;
    }
    dispose() { }
    _buildProvider(dataSource, cache) {
        return new _providers__WEBPACK_IMPORTED_MODULE_5__.TileContentProvider(dataSource, cache);
    }
}
//# sourceMappingURL=tiles.map.layer.js.map

/***/ }),

/***/ "./dist/tiles/map/tiles.map.layerView.js":
/*!***********************************************!*\
  !*** ./dist/tiles/map/tiles.map.layerView.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileMapLayerView: () => (/* binding */ TileMapLayerView)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../events */ "./dist/events/events.observable.js");
/* harmony import */ var _providers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../providers */ "./dist/tiles/providers/tiles.provider.abstract.js");
/* harmony import */ var _tiles_map_view__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.map.view */ "./dist/tiles/map/tiles.map.view.js");



class TileMapLayerView extends _providers__WEBPACK_IMPORTED_MODULE_0__.AbstractTileProvider {
    constructor(layer, display, navigation, source) {
        super();
        this._layer = layer;
        this._layerObserver = layer.propertyChangedObservable.add(this._onLayerPropertyChanged.bind(this));
        this._navigation = navigation;
        this._display = display;
        this._view = source;
        this._view?.linkTo(this);
        this.factory.withMetrics(this._layer.metrics).withNamespace(this._layer.name);
    }
    get weightChangedObservable() {
        if (!this._weightChangedObservable) {
            this._weightChangedObservable = new _events__WEBPACK_IMPORTED_MODULE_1__.Observable();
        }
        return this._weightChangedObservable;
    }
    get weight() {
        return this._layer.weight;
    }
    get name() {
        return this._layer.name;
    }
    get layer() {
        return this._layer;
    }
    get display() {
        return this._display;
    }
    get navigation() {
        return this._navigation;
    }
    get view() {
        return this._view;
    }
    dispose() {
        super.dispose();
        this._view?.unlinkFrom(this);
        this._layerObserver?.disconnect();
    }
    setContext(state, display, metrics, options) {
        this._view?.setContext(state, display, metrics, options);
    }
    _buildSource() {
        return new _tiles_map_view__WEBPACK_IMPORTED_MODULE_2__.TileView();
    }
    _onLayerPropertyChanged(eventData, eventState) {
        switch (eventData.propertyName) {
            case "weight": {
                if (this._weightChangedObservable && this._weightChangedObservable.hasObservers()) {
                    this._weightChangedObservable.notifyObservers(this, -1, this, this);
                }
                break;
            }
        }
        this.invalidate();
    }
    _onNavigationPropertyChanged(eventData, eventState) { }
    _onDisplayPropertyChanged(eventData, eventState) { }
    _fetchContent(tile, callback) {
        return this._layer.provider.fetchContent(tile, callback);
    }
}
//# sourceMappingURL=tiles.map.layerView.js.map

/***/ }),

/***/ "./dist/tiles/map/tiles.map.view.js":
/*!******************************************!*\
  !*** ./dist/tiles/map/tiles.map.view.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileView: () => (/* binding */ TileView)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../events */ "./dist/events/events.observable.js");
/* harmony import */ var _address__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../address */ "./dist/tiles/address/tiles.address.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.bounds.js");
/* harmony import */ var _pipeline_tiles_pipeline_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../pipeline/tiles.pipeline.link */ "./dist/tiles/pipeline/tiles.pipeline.link.js");




class TileView {
    constructor() {
        this._activ = new Map();
        this._links = [];
    }
    dispose() {
        for (const l of this._links) {
            l.dispose();
        }
        this._links = [];
    }
    get addedObservable() {
        this._addedObservable = this._addedObservable || new _events__WEBPACK_IMPORTED_MODULE_0__.Observable();
        return this._addedObservable;
    }
    get removedObservable() {
        this._removedObservable = this._removedObservable || new _events__WEBPACK_IMPORTED_MODULE_0__.Observable();
        return this._removedObservable;
    }
    get updatedObservable() {
        this._updatedObservable = this._updatedObservable || new _events__WEBPACK_IMPORTED_MODULE_0__.Observable();
        return this._updatedObservable;
    }
    linkTo(target, options) {
        if (this._links.findIndex((l) => l.target === target) === -1) {
            const link = new _pipeline_tiles_pipeline_link__WEBPACK_IMPORTED_MODULE_1__.TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }
    unlinkFrom(target) {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }
    setContext(state, display, metrics, options) {
        if (!state || !display) {
            this._doClearContext(state, this._activ, options);
            return;
        }
        this._doValidateContext(state, display, metrics, this._activ, options);
    }
    _doValidateContext(state, display, metrics, activAddresses, options) {
        if (state && display) {
            const lod = _address__WEBPACK_IMPORTED_MODULE_2__.TileAddress.ClampLod(state.lod, metrics) + (options?.zoomOffset ?? 0);
            const scale = state.scale;
            const nwTileXY = _geometry__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.Zero();
            const seTileXY = _geometry__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.Zero();
            const pixelCenterXY = metrics.getLatLonToPointXY(state.center.lat, state.center.lon, lod);
            let w = display?.resolution.width ?? 0;
            let h = display?.resolution.height ?? 0;
            let rect = this._getRectangle(pixelCenterXY, w, h, scale, state.azimuth);
            let testRect = state.azimuth?.value ? this._getRectangle(pixelCenterXY, w, h, scale) : null;
            metrics.getPointXYToTileXYToRef(rect.xmin, rect.ymin, nwTileXY);
            metrics.getPointXYToTileXYToRef(rect.xmax, rect.ymax, seTileXY);
            const maxIndex = metrics.mapSize(lod) / metrics.tileSize - 1;
            const x0 = Math.max(0, nwTileXY.x);
            const y0 = Math.max(0, nwTileXY.y);
            const x1 = Math.min(maxIndex, seTileXY.x);
            const y1 = Math.min(maxIndex, seTileXY.y);
            const remains = new Array();
            const added = new Array();
            const tmp = new _address__WEBPACK_IMPORTED_MODULE_2__.TileAddress(0, 0, lod);
            for (tmp.y = y0; tmp.y <= y1; tmp.y++) {
                for (tmp.x = x0; tmp.x <= x1; tmp.x++) {
                    if (testRect) {
                        const tileRect = this._getTileRectangle(tmp, metrics, pixelCenterXY, state.azimuth);
                        if (testRect.intersects(tileRect) == false) {
                            continue;
                        }
                    }
                    const key = tmp.quadkey;
                    const activ = activAddresses.get(key);
                    if (activ) {
                        remains.push(activ);
                        activAddresses.delete(key);
                        continue;
                    }
                    added.push(tmp.clone());
                }
            }
            let deleted = Array.from(activAddresses.values());
            activAddresses.clear();
            for (const a of remains) {
                activAddresses.set(a.quadkey, a);
            }
            for (const a of added) {
                activAddresses.set(a.quadkey, a);
            }
            if (options?.dispatchEvent ?? true) {
                if (deleted.length && this._removedObservable?.hasObservers()) {
                    this._removedObservable.notifyObservers(deleted, -1, this, this);
                }
                if (added.length && this._addedObservable?.hasObservers()) {
                    this._addedObservable.notifyObservers(added, -1, this, this);
                }
            }
        }
    }
    _doClearContext(state, activAddresses, options) {
        if (state) {
            let deleted = Array.from(activAddresses.values());
            activAddresses.clear();
            if (options?.dispatchEvent ?? true) {
                if (deleted.length && this._removedObservable?.hasObservers()) {
                    this._removedObservable.notifyObservers(deleted, -1, this, this);
                }
            }
        }
    }
    _getRectangle(center, w, h, scale, azimuth) {
        w = w / scale;
        h = h / scale;
        const x0 = center.x - w / 2;
        const y0 = center.y - h / 2;
        const bounds = new _geometry__WEBPACK_IMPORTED_MODULE_4__.Bounds2(x0, y0, w, h);
        return azimuth?.value ? _geometry__WEBPACK_IMPORTED_MODULE_4__.Bounds2.FromPoints(...this._rotatePointsArround(center, azimuth, ...bounds.points())) : bounds;
    }
    _getTileRectangle(a, metrics, center, azimuth) {
        const points = [
            metrics.getTileXYToPointXY(a.x, a.y),
            metrics.getTileXYToPointXY(a.x + 1, a.y),
            metrics.getTileXYToPointXY(a.x + 1, a.y + 1),
            metrics.getTileXYToPointXY(a.x, a.y + 1),
        ];
        return _geometry__WEBPACK_IMPORTED_MODULE_4__.Bounds2.FromPoints(...this._rotatePointsArround(center, azimuth, ...points));
    }
    *_rotatePointsArround(center, azimuth, ...points) {
        for (const p of points) {
            yield this._rotatePointArround(p.x, p.y, center, azimuth, p);
        }
    }
    _rotatePointArround(x, y, center, azimuth, target) {
        const r = target || _geometry__WEBPACK_IMPORTED_MODULE_3__.Cartesian2.Zero();
        const translatedX = x - center.x;
        const translatedY = y - center.y;
        const cos = azimuth?.cos ?? 1;
        const sin = azimuth?.sin ?? 0;
        r.x = translatedX * cos - translatedY * sin + center.x;
        r.y = translatedX * sin + translatedY * cos + center.y;
        return r;
    }
}
//# sourceMappingURL=tiles.map.view.js.map

/***/ }),

/***/ "./dist/tiles/map/typed/index.js":
/*!***************************************!*\
  !*** ./dist/tiles/map/typed/index.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Float32Layer: () => (/* reexport safe */ _tiles_map_layer_float32__WEBPACK_IMPORTED_MODULE_0__.Float32Layer),
/* harmony export */   ImageLayer: () => (/* reexport safe */ _tiles_map_layer_image__WEBPACK_IMPORTED_MODULE_1__.ImageLayer),
/* harmony export */   TileMapVectorLayer: () => (/* reexport safe */ _tiles_map_layer_vector__WEBPACK_IMPORTED_MODULE_2__.TileMapVectorLayer)
/* harmony export */ });
/* harmony import */ var _tiles_map_layer_float32__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.map.layer.float32 */ "./dist/tiles/map/typed/tiles.map.layer.float32.js");
/* harmony import */ var _tiles_map_layer_image__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.map.layer.image */ "./dist/tiles/map/typed/tiles.map.layer.image.js");
/* harmony import */ var _tiles_map_layer_vector__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.map.layer.vector */ "./dist/tiles/map/typed/tiles.map.layer.vector.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/map/typed/tiles.map.layer.float32.js":
/*!*********************************************************!*\
  !*** ./dist/tiles/map/typed/tiles.map.layer.float32.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Float32Layer: () => (/* binding */ Float32Layer)
/* harmony export */ });
/* harmony import */ var _tiles_map_layer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.map.layer */ "./dist/tiles/map/tiles.map.layer.js");

class Float32Layer extends _tiles_map_layer__WEBPACK_IMPORTED_MODULE_0__.TileMapLayer {
    constructor(name, provider, options, enabled) {
        super(name, provider, options, enabled);
    }
}
//# sourceMappingURL=tiles.map.layer.float32.js.map

/***/ }),

/***/ "./dist/tiles/map/typed/tiles.map.layer.image.js":
/*!*******************************************************!*\
  !*** ./dist/tiles/map/typed/tiles.map.layer.image.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ImageLayer: () => (/* binding */ ImageLayer)
/* harmony export */ });
/* harmony import */ var _tiles_map_layer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.map.layer */ "./dist/tiles/map/tiles.map.layer.js");

class ImageLayer extends _tiles_map_layer__WEBPACK_IMPORTED_MODULE_0__.TileMapLayer {
    constructor(name, provider, options, enabled) {
        super(name, provider, options, enabled);
        this._draw = this._draw ?? this._renderTile.bind(this);
    }
    _renderTile(ctx, tile, w, h) {
        ctx.drawImage(tile.content, 0, 0, w + 1, h + 1);
    }
}
//# sourceMappingURL=tiles.map.layer.image.js.map

/***/ }),

/***/ "./dist/tiles/map/typed/tiles.map.layer.vector.js":
/*!********************************************************!*\
  !*** ./dist/tiles/map/typed/tiles.map.layer.vector.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileMapVectorLayer: () => (/* binding */ TileMapVectorLayer)
/* harmony export */ });
/* harmony import */ var _vector__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../vector */ "./dist/tiles/vector/tiles.vector.renderer.js");
/* harmony import */ var _tiles_map_layer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.map.layer */ "./dist/tiles/map/tiles.map.layer.js");


class TileMapVectorLayer extends _tiles_map_layer__WEBPACK_IMPORTED_MODULE_0__.TileMapLayer {
    constructor(name, source, options, enabled = true) {
        super(name, source, options, enabled);
        if (options.style instanceof _vector__WEBPACK_IMPORTED_MODULE_1__.TileVectorRenderer) {
            this._renderer = options.style;
        }
        else {
            this._renderer = new _vector__WEBPACK_IMPORTED_MODULE_1__.TileVectorRenderer(options.style);
        }
        this._draw = this._draw ?? this._renderTile.bind(this);
    }
    _renderTile(ctx, tile, w, h) {
        this._clip(ctx, 0, 0, w, h);
        this._renderer.renderTile(tile.content, ctx, w, h);
    }
    _clip(ctx, x, y, w, h) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
    }
}
//# sourceMappingURL=tiles.map.layer.vector.js.map

/***/ }),

/***/ "./dist/tiles/navigation/index.js":
/*!****************************************!*\
  !*** ./dist/tiles/navigation/index.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsTileNavigationApi: () => (/* reexport safe */ _tiles_navigation_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsTileNavigationApi),
/* harmony export */   IsTileNavigationState: () => (/* reexport safe */ _tiles_navigation_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsTileNavigationState),
/* harmony export */   TileNavigationState: () => (/* reexport safe */ _tiles_navigation_state__WEBPACK_IMPORTED_MODULE_1__.TileNavigationState),
/* harmony export */   TileNavigationStateSynchronizer: () => (/* reexport safe */ _tiles_navigation_state_sync__WEBPACK_IMPORTED_MODULE_2__.TileNavigationStateSynchronizer),
/* harmony export */   hasNavigationApi: () => (/* reexport safe */ _tiles_navigation_interfaces__WEBPACK_IMPORTED_MODULE_0__.hasNavigationApi),
/* harmony export */   hasNavigationState: () => (/* reexport safe */ _tiles_navigation_interfaces__WEBPACK_IMPORTED_MODULE_0__.hasNavigationState)
/* harmony export */ });
/* harmony import */ var _tiles_navigation_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.navigation.interfaces */ "./dist/tiles/navigation/tiles.navigation.interfaces.js");
/* harmony import */ var _tiles_navigation_state__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.navigation.state */ "./dist/tiles/navigation/tiles.navigation.state.js");
/* harmony import */ var _tiles_navigation_state_sync__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.navigation.state.sync */ "./dist/tiles/navigation/tiles.navigation.state.sync.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/navigation/tiles.navigation.interfaces.js":
/*!**************************************************************!*\
  !*** ./dist/tiles/navigation/tiles.navigation.interfaces.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsTileNavigationApi: () => (/* binding */ IsTileNavigationApi),
/* harmony export */   IsTileNavigationState: () => (/* binding */ IsTileNavigationState),
/* harmony export */   hasNavigationApi: () => (/* binding */ hasNavigationApi),
/* harmony export */   hasNavigationState: () => (/* binding */ hasNavigationState)
/* harmony export */ });
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geography */ "./dist/geography/geography.interfaces.js");
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../geography */ "./dist/geography/geography.bearing.js");
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");


function hasNavigationState(obj) {
    if (typeof obj !== "object" || obj === null)
        return false;
    return obj.navigation !== undefined;
}
function IsTileNavigationState(b) {
    if (b === null || typeof b !== "object")
        return false;
    return (IsTileNavigationApi(b) &&
        b.center !== undefined &&
        (0,_geography__WEBPACK_IMPORTED_MODULE_0__.IsLocation)(b.center) &&
        b.zoom !== undefined &&
        b.azimuth !== undefined &&
        b.azimuth instanceof _geography__WEBPACK_IMPORTED_MODULE_1__.Bearing &&
        b.bounds !== undefined &&
        (0,_tiles_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsTileSystemBounds)(b.bounds));
}
function IsTileNavigationApi(b) {
    if (b === null || typeof b !== "object")
        return false;
    return (b.setViewMap !== undefined &&
        b.zoomInMap !== undefined &&
        b.zoomOutMap !== undefined &&
        b.translateUnitsMap !== undefined &&
        b.translateMap !== undefined &&
        b.rotateMap !== undefined);
}
function hasNavigationApi(obj) {
    if (typeof obj !== "object" || obj === null)
        return false;
    return obj.navigationApi !== undefined;
}
//# sourceMappingURL=tiles.navigation.interfaces.js.map

/***/ }),

/***/ "./dist/tiles/navigation/tiles.navigation.state.js":
/*!*********************************************************!*\
  !*** ./dist/tiles/navigation/tiles.navigation.state.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileNavigationState: () => (/* binding */ TileNavigationState)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../events */ "./dist/events/events.args.js");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../events */ "./dist/events/events.observable.js");
/* harmony import */ var _validable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../validable */ "./dist/validable.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../geography */ "./dist/geography/geography.interfaces.js");
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../geography */ "./dist/geography/geography.position.js");
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../geography */ "./dist/geography/geography.bearing.js");
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../geography */ "./dist/tiles/geography/tiles.geography.EPSG3857.js");
/* harmony import */ var _tiles_system__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../tiles.system */ "./dist/tiles/tiles.system.js");
/* harmony import */ var _tiles_navigation_state_sync__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./tiles.navigation.state.sync */ "./dist/tiles/navigation/tiles.navigation.state.sync.js");







class TileNavigationState extends _validable__WEBPACK_IMPORTED_MODULE_0__.ValidableBase {
    static GetLodScale(lod) {
        let lodOffset = (lod * 1000 - Math.round(lod) * 1000) / 1000;
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        return scale;
    }
    constructor(center, lod, azimuth, bounds) {
        super();
        this._cartesianCache = _geometry__WEBPACK_IMPORTED_MODULE_1__.Cartesian2.Zero();
        this._lodf = lod ?? 0;
        this._center = center ? ((0,_geography__WEBPACK_IMPORTED_MODULE_2__.IsLocation)(center) ? new _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2(center?.lat ?? 0, center?.lon ?? 0) : new _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2(center[0] ?? 0, center[1] ?? 0)) : _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2.Zero();
        this._azimuth = new _geography__WEBPACK_IMPORTED_MODULE_4__.Bearing(azimuth ?? 0);
        this._bounds = bounds ?? new _tiles_system__WEBPACK_IMPORTED_MODULE_5__.TileSystemBounds();
        this._boundsObserver = this._bounds.propertyChangedObservable.add(this._boundsPropertyChanged.bind(this));
        this._lod = Math.round(this._lodf);
        this._scale = TileNavigationState.GetLodScale(this._lodf);
        this._sync = null;
    }
    clone() {
        return new TileNavigationState(this._center, this._lod, this._azimuth.value, this._bounds);
    }
    dispose() {
        this._boundsObserver?.disconnect;
        this._boundsObserver = null;
        if (this._sync) {
            this._sync.dispose();
            this._sync = null;
        }
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
    set center(center) {
        center = center ?? _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2.Zero();
        const lat = Math.min(Math.max(center.lat, this._bounds.minLatitude), this._bounds.maxLatitude);
        const lon = Math.min(Math.max(center.lon, this._bounds.minLongitude), this._bounds.maxLongitude);
        if (this._center.lat != lat || this._center.lon != lon) {
            if (this._propertyChangedObservable?.hasObservers()) {
                const old = this._center.clone();
                this._center.lat = lat;
                this._center.lon = lon;
                const e = new _events__WEBPACK_IMPORTED_MODULE_6__.PropertyChangedEventArgs(this, old, this._center.clone(), "center");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
                this.invalidate();
                return;
            }
            this._center.lat = lat;
            this._center.lon = lon;
            this.invalidate();
        }
    }
    get zoom() {
        return this._lodf;
    }
    set zoom(lodf) {
        lodf = Math.min(Math.max(lodf, this._bounds.minLOD), this._bounds.maxLOD);
        if (this._lodf != lodf) {
            const old = this._lodf;
            this._lodf = lodf;
            this._lod = Math.round(this._lodf);
            this._scale = TileNavigationState.GetLodScale(this._lodf);
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new _events__WEBPACK_IMPORTED_MODULE_6__.PropertyChangedEventArgs(this, old, this._lodf, "zoom");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }
    get azimuth() {
        return this._azimuth;
    }
    set azimuth(r) {
        if (this._azimuth.value != r.value) {
            const old = this._azimuth;
            this._azimuth = r;
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new _events__WEBPACK_IMPORTED_MODULE_6__.PropertyChangedEventArgs(this, old, this._azimuth, "azimuth");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }
    get bounds() {
        return this._bounds;
    }
    set bounds(bounds) {
        if (this._bounds !== bounds) {
            this._boundsObserver?.disconnect;
            const old = this._bounds;
            this._bounds = bounds;
            this._boundsObserver = this._bounds.propertyChangedObservable.add(this._boundsPropertyChanged.bind(this));
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new _events__WEBPACK_IMPORTED_MODULE_6__.PropertyChangedEventArgs(this, old, this._bounds, "bounds");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }
    get propertyChangedObservable() {
        if (!this._propertyChangedObservable)
            this._propertyChangedObservable = new _events__WEBPACK_IMPORTED_MODULE_7__.Observable();
        return this._propertyChangedObservable;
    }
    setViewMap(center, zoom, rotation, validate) {
        if (center) {
            let lat = 0;
            let lon = 0;
            if (Array.isArray(center)) {
                lat = center.length > 0 ? center[0] : 0;
                lon = center.length > 1 ? center[1] : 0;
            }
            else {
                lat = center.lat;
                lon = center.lon;
            }
            this.center = new _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2(lat, lon);
        }
        if (zoom !== undefined) {
            this.zoom = zoom;
        }
        if (rotation !== undefined && rotation !== this._azimuth?.value) {
            this.azimuth = new _geography__WEBPACK_IMPORTED_MODULE_4__.Bearing(rotation);
        }
        if (validate === undefined || validate === true) {
            this.validate();
        }
        return this;
    }
    zoomInMap(delta, validate) {
        this.zoom = this._lodf + Math.abs(delta);
        if (validate === undefined || validate === true) {
            this.validate();
        }
        return this;
    }
    zoomMap(delta, validate) {
        this.zoom = this._lodf + delta;
        if (validate === undefined || validate === true) {
            this.validate();
        }
        return this;
    }
    zoomOutMap(delta, validate) {
        this.zoom = this._lodf - Math.abs(delta);
        if (validate === undefined || validate === true) {
            this.validate();
        }
        return this;
    }
    translateUnitsMap(tx, ty, metrics, validate) {
        const m = metrics ?? _geography__WEBPACK_IMPORTED_MODULE_8__.EPSG3857.Shared;
        if (this._azimuth?.value) {
            const p = this.rotatePointInv(tx, ty, this._cartesianCache);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this._lodf);
        const pixelCenterXY = m.getLatLonToPointXY(this._center.lat, this._center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        this.center = m.getPointXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        if (validate === undefined || validate === true) {
            this.validate();
        }
        return this;
    }
    translateMap(lat, lon, validate) {
        if (lat) {
            let dlat;
            let dlon;
            if (Array.isArray(lat)) {
                dlat = lat.length > 0 ? lat[0] : 0;
                dlon = lat.length > 1 ? lat[1] : 0;
            }
            else if ((0,_geography__WEBPACK_IMPORTED_MODULE_2__.IsLocation)(lat)) {
                dlat = lat.lat;
                dlon = lat.lon;
            }
            else {
                dlat = lat;
                dlon = lon ?? 0;
            }
            this.center = new _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2(this._center.lat + dlat, this._center.lon + dlon);
            if (validate === undefined || validate === true) {
                this.validate();
            }
        }
        return this;
    }
    rotateMap(r, validate) {
        this.azimuth = new _geography__WEBPACK_IMPORTED_MODULE_4__.Bearing(this._azimuth.value + r);
        if (validate === undefined || validate === true) {
            this.validate();
        }
        return this;
    }
    syncWith(state) {
        if (this._sync) {
            this._sync.dispose();
            this._sync = null;
        }
        if (state) {
            this.setViewMap(state.center, state.zoom, state.azimuth.value).validate();
            this._sync = new _tiles_navigation_state_sync__WEBPACK_IMPORTED_MODULE_9__.TileNavigationStateSynchronizer(state, this);
        }
        return this;
    }
    toString() {
        return `center: ${this.center}, zoom: ${this.zoom}, azimuth: ${this.azimuth}`;
    }
    rotatePointInv(x, y, target) {
        const r = target || _geometry__WEBPACK_IMPORTED_MODULE_1__.Cartesian2.Zero();
        r.x = x * this._azimuth.cos + y * this._azimuth.sin;
        r.y = -x * this._azimuth.sin + y * this._azimuth.cos;
        return r;
    }
    _boundsPropertyChanged(e, state) {
        this.setViewMap(this._center, this._lodf);
    }
}
//# sourceMappingURL=tiles.navigation.state.js.map

/***/ }),

/***/ "./dist/tiles/navigation/tiles.navigation.state.sync.js":
/*!**************************************************************!*\
  !*** ./dist/tiles/navigation/tiles.navigation.state.sync.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileNavigationStateSynchronizer: () => (/* binding */ TileNavigationStateSynchronizer)
/* harmony export */ });
class TileNavigationStateSynchronizer {
    constructor(source, target, enabled = true) {
        this._source = source;
        this._target = target;
        this._enabled = enabled;
        this._sourceChangedObserver = this._source.validationObservable?.add(this._onSourceValidation.bind(this));
        this._propertyChangedObserver = this._source.propertyChangedObservable.add(this._onSourcePropertyChanged.bind(this));
    }
    dispose() {
        this._sourceChangedObserver?.disconnect();
        this._propertyChangedObserver?.disconnect();
    }
    get source() {
        return this._source;
    }
    get target() {
        return this._target;
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(v) {
        this._enabled = v;
    }
    _onSourceValidation(state, eventState) {
        if (state && this._enabled) {
            this._target.validate();
        }
    }
    _onSourcePropertyChanged(property, eventState) {
        if (this._enabled && property.propertyName) {
            this._target[property.propertyName] = property.newValue;
        }
    }
}
//# sourceMappingURL=tiles.navigation.state.sync.js.map

/***/ }),

/***/ "./dist/tiles/pipeline/index.js":
/*!**************************************!*\
  !*** ./dist/tiles/pipeline/index.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsTargetBlock: () => (/* reexport safe */ _tiles_pipeline_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsTargetBlock),
/* harmony export */   IsTileMipMapping: () => (/* reexport safe */ _tiles_pipeline_interfaces__WEBPACK_IMPORTED_MODULE_0__.IsTileMipMapping),
/* harmony export */   TilePipelineLink: () => (/* reexport safe */ _tiles_pipeline_link__WEBPACK_IMPORTED_MODULE_1__.TilePipelineLink),
/* harmony export */   hasTileSelectionContext: () => (/* reexport safe */ _tiles_pipeline_interfaces__WEBPACK_IMPORTED_MODULE_0__.hasTileSelectionContext),
/* harmony export */   isViewProxy: () => (/* reexport safe */ _tiles_pipeline_interfaces__WEBPACK_IMPORTED_MODULE_0__.isViewProxy)
/* harmony export */ });
/* harmony import */ var _tiles_pipeline_interfaces__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.pipeline.interfaces */ "./dist/tiles/pipeline/tiles.pipeline.interfaces.js");
/* harmony import */ var _tiles_pipeline_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.pipeline.link */ "./dist/tiles/pipeline/tiles.pipeline.link.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/pipeline/tiles.pipeline.interfaces.js":
/*!**********************************************************!*\
  !*** ./dist/tiles/pipeline/tiles.pipeline.interfaces.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsTargetBlock: () => (/* binding */ IsTargetBlock),
/* harmony export */   IsTileMipMapping: () => (/* binding */ IsTileMipMapping),
/* harmony export */   hasTileSelectionContext: () => (/* binding */ hasTileSelectionContext),
/* harmony export */   isViewProxy: () => (/* binding */ isViewProxy)
/* harmony export */ });
function IsTargetBlock(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.added !== undefined && b.removed !== undefined && b.updated !== undefined;
}
function IsTileMipMapping(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.split !== undefined && b.stitch !== undefined;
}
function hasTileSelectionContext(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.setContext !== undefined;
}
function isViewProxy(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.view !== undefined;
}
//# sourceMappingURL=tiles.pipeline.interfaces.js.map

/***/ }),

/***/ "./dist/tiles/pipeline/tiles.pipeline.link.js":
/*!****************************************************!*\
  !*** ./dist/tiles/pipeline/tiles.pipeline.link.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TilePipelineLink: () => (/* binding */ TilePipelineLink)
/* harmony export */ });
class TilePipelineLink {
    constructor(source, target, options) {
        this._source = source;
        this._target = target;
        this._options = options;
        this._addedObserver = source.addedObservable.add(this._onAdded.bind(this));
        this._removedObserver = source.removedObservable.add(this._onRemoved.bind(this));
        this._updatedObserver = source.updatedObservable.add(this._onUpdated.bind(this));
    }
    get source() {
        return this._source;
    }
    get target() {
        return this._target;
    }
    get options() {
        return this._options;
    }
    dispose() {
        this._addedObserver?.disconnect();
        this._removedObserver?.disconnect();
        this._updatedObserver?.disconnect();
        this._addedObserver = null;
        this._removedObserver = null;
        this._updatedObserver = null;
    }
    _onAdded(eventData, eventState) {
        if (this._target && this._target.added) {
            const filter = this._options?.acceptAdded ?? this.options?.accept;
            eventData = filter ? this._filter(eventData, filter) : eventData;
            this._target.added(eventData, eventState);
        }
    }
    _onRemoved(eventData, eventState) {
        if (this._target && this._target.removed) {
            const filter = this._options?.acceptRemoved ?? this.options?.accept;
            eventData = filter ? this._filter(eventData, filter) : eventData;
            this._target.removed(eventData, eventState);
        }
    }
    _onUpdated(eventData, eventState) {
        if (this._target && this._target.updated) {
            const filter = this._options?.acceptUpdated ?? this.options?.accept;
            eventData = filter ? this._filter(eventData, filter) : eventData;
            this._target.updated(eventData, eventState);
        }
    }
    _filter(eventData, filter) {
        const filtered = [];
        for (let i = 0; i != eventData.length; i++) {
            const d = eventData[i];
            if (filter(d)) {
                filtered.push(d);
            }
        }
        return filtered;
    }
}
//# sourceMappingURL=tiles.pipeline.link.js.map

/***/ }),

/***/ "./dist/tiles/providers/index.js":
/*!***************************************!*\
  !*** ./dist/tiles/providers/index.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractTileProvider: () => (/* reexport safe */ _tiles_provider_abstract__WEBPACK_IMPORTED_MODULE_1__.AbstractTileProvider),
/* harmony export */   TileContentProvider: () => (/* reexport safe */ _tiles_provider_content__WEBPACK_IMPORTED_MODULE_0__.TileContentProvider),
/* harmony export */   TileProvider: () => (/* reexport safe */ _tiles_provider__WEBPACK_IMPORTED_MODULE_2__.TileProvider)
/* harmony export */ });
/* harmony import */ var _tiles_provider_content__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.provider.content */ "./dist/tiles/providers/tiles.provider.content.js");
/* harmony import */ var _tiles_provider_abstract__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.provider.abstract */ "./dist/tiles/providers/tiles.provider.abstract.js");
/* harmony import */ var _tiles_provider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.provider */ "./dist/tiles/providers/tiles.provider.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/providers/tiles.provider.abstract.js":
/*!*********************************************************!*\
  !*** ./dist/tiles/providers/tiles.provider.abstract.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractTileProvider: () => (/* binding */ AbstractTileProvider)
/* harmony export */ });
/* harmony import */ var _events_events_observable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../events/events.observable */ "./dist/events/events.observable.js");
/* harmony import */ var _tiles_collection__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles.collection */ "./dist/tiles/tiles.collection.js");
/* harmony import */ var _tiles_builder__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../tiles.builder */ "./dist/tiles/tiles.builder.js");
/* harmony import */ var _pipeline__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../pipeline */ "./dist/tiles/pipeline/tiles.pipeline.link.js");
/* harmony import */ var _validable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../validable */ "./dist/validable.js");





class AbstractTileProvider extends _validable__WEBPACK_IMPORTED_MODULE_0__.ValidableBase {
    constructor(factory, enabled = true) {
        super();
        this._links = [];
        this._factory = factory ?? this._buildFactory();
        this._enabled = enabled;
        this._activTiles = new _tiles_collection__WEBPACK_IMPORTED_MODULE_1__.TileCollection();
        this._callback = this._onContentFetched.bind(this);
    }
    get geoBounds() {
        return this._activTiles?.geoBounds;
    }
    get bounds() {
        return this._activTiles?.bounds;
    }
    get enabledObservable() {
        this._enabledObservable = this._enabledObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_2__.Observable();
        return this._enabledObservable;
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(v) {
        if (this._enabled !== v) {
            this._enabled = v;
            if (this._enabledObservable && this._enabledObservable.hasObservers()) {
                this._enabledObservable.notifyObservers(this, -1, this, this);
            }
        }
    }
    get metrics() {
        return this.factory.metrics;
    }
    get namespace() {
        return this.factory.namespace;
    }
    get factory() {
        return this._factory;
    }
    dispose() {
        this._activTiles?.clear();
    }
    get activTiles() {
        return Array.from(this._activTiles);
    }
    getTile(a) {
        return this._activTiles.get(a);
    }
    hasTile(a) {
        return this._activTiles.has(a);
    }
    get updatedObservable() {
        this._updateObservable = this._updateObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_2__.Observable();
        return this._updateObservable;
    }
    get addedObservable() {
        this._addedObservable = this._addedObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_2__.Observable();
        return this._addedObservable;
    }
    get removedObservable() {
        this._removedObservable = this._removedObservable || new _events_events_observable__WEBPACK_IMPORTED_MODULE_2__.Observable();
        return this._removedObservable;
    }
    linkTo(target, options) {
        if (this._links.findIndex((l) => l.target === target) === -1) {
            const link = new _pipeline__WEBPACK_IMPORTED_MODULE_3__.TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }
    unlinkFrom(target) {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }
    added(eventData, eventState) {
        const data = Array.isArray(eventData) ? eventData : [eventData];
        const tiles = this._onTileAddressesAdded(data, eventState);
        if (tiles.length) {
            this.invalidate();
            this._onTilesAdded(tiles);
            if (this._addedObservable && this._addedObservable.hasObservers()) {
                this._addedObservable.notifyObservers(tiles, -1, this, this);
            }
        }
    }
    removed(eventData, eventState) {
        const data = Array.isArray(eventData) ? eventData : [eventData];
        const tiles = this._onTileAddressesRemoved(data, eventState);
        if (tiles.length) {
            this.invalidate();
            this._onTilesRemoved(tiles);
            if (this._removedObservable && this._removedObservable.hasObservers()) {
                this._removedObservable?.notifyObservers(tiles, -1, this, this);
            }
        }
    }
    updated(eventData, eventState) {
    }
    _onTileAddressesAdded(address, eventState) {
        const toActivate = address.length === 0 ? [...(this._activTiles ?? [])].map((t) => t.address) : address;
        const tiles = new Array();
        for (const a of toActivate ?? []) {
            const t = this._activTiles?.get(a);
            if (t) {
                tiles.push(t);
                continue;
            }
            const factory = this._factory.withAddress(a);
            try {
                let tile = factory.build();
                if (tile) {
                    tile = this._fetchContent(tile, this._callback);
                    this._activTiles?.add(tile);
                    tiles.push(tile);
                }
            }
            catch (e) {
                console.log(e);
            }
        }
        return tiles;
    }
    _onTileAddressesRemoved(address, eventState) {
        if (this._activTiles && this._activTiles.count) {
            const tiles = new Array();
            for (const a of address ?? []) {
                const t = this._activTiles?.get(a);
                if (t) {
                    tiles.push(t);
                    this._activTiles?.remove(a);
                }
            }
            return tiles;
        }
        return [];
    }
    _onContentFetched(tile) {
        this.invalidate();
        this._onTilesUpdated(tile);
        if (this.updatedObservable?.hasObservers()) {
            this.updatedObservable.notifyObservers([tile], -1, this, this);
        }
    }
    _buildFactory(type) {
        const b = new _tiles_builder__WEBPACK_IMPORTED_MODULE_4__.TileBuilder();
        return type ? b.withType(type) : b;
    }
    _onTilesAdded(tiles) { }
    _onTilesRemoved(tiles) { }
    _onTilesUpdated(tiles) { }
}
//# sourceMappingURL=tiles.provider.abstract.js.map

/***/ }),

/***/ "./dist/tiles/providers/tiles.provider.content.js":
/*!********************************************************!*\
  !*** ./dist/tiles/providers/tiles.provider.content.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileContentProvider: () => (/* binding */ TileContentProvider)
/* harmony export */ });
/* harmony import */ var _cache_cache__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../cache/cache */ "./dist/cache/cache.js");
/* harmony import */ var _address_tiles_address__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../address/tiles.address */ "./dist/tiles/address/tiles.address.js");


class TileContentProvider {
    constructor(datasource, cache) {
        this._datasource = datasource;
        this._cache = cache || new _cache_cache__WEBPACK_IMPORTED_MODULE_0__.MemoryCache();
        if (cache) {
            this._prefix = this._buildPrefix();
            this._ownCache = false;
        }
        else {
            this._ownCache = true;
        }
    }
    accept(address) {
        return _address_tiles_address__WEBPACK_IMPORTED_MODULE_1__.TileAddress.IsValidAddress(address, this.metrics);
    }
    get name() {
        return this._datasource.name;
    }
    get datasource() {
        return this._datasource;
    }
    get metrics() {
        return this._datasource.metrics;
    }
    dispose() {
        if (this._prefix && !this._ownCache) {
            const p = this._prefix;
            this._cache.clear((k) => k.startsWith(p));
            return;
        }
        this._cache.clear();
    }
    fetchContent(tile, callback) {
        const address = tile.address;
        const cacheKey = this._buildCacheKey(address.quadkey);
        if (this._cache.contains(cacheKey)) {
            tile.content = this._cache.get(cacheKey);
            return tile;
        }
        let c = this._buildTemporaryContent(address);
        this._cache.set(cacheKey, c);
        this._datasource.fetchAsync(address, tile).then((result) => {
            if (result.ok) {
                this._cache.set(this._buildCacheKey(address.quadkey), result.content);
                tile.content = result.content;
                callback?.(tile);
            }
            else {
                console.log(`the fetch operation has failed because of ${result.statusText}`);
                callback?.(tile);
            }
        }, (reason) => {
            console.log(`the fetch operation has failed because of ${reason}`);
            callback?.(tile);
        });
        tile.content = c;
        return tile;
    }
    _buildTemporaryContent(address) {
        return null;
    }
    _buildAlternativContent(address) {
        return null;
    }
    _buildPrefix() {
        let p = `${this.name}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}_`;
        while (this._cache?.any((k) => k.startsWith(p))) {
            p = `${this.name}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}_`;
        }
        return p;
    }
    _buildCacheKey(key) {
        return this._prefix ? `${key}` : `${this._prefix}${key}`;
    }
}
//# sourceMappingURL=tiles.provider.content.js.map

/***/ }),

/***/ "./dist/tiles/providers/tiles.provider.js":
/*!************************************************!*\
  !*** ./dist/tiles/providers/tiles.provider.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileProvider: () => (/* binding */ TileProvider)
/* harmony export */ });
/* harmony import */ var _tiles_provider_abstract__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.provider.abstract */ "./dist/tiles/providers/tiles.provider.abstract.js");

class TileProvider extends _tiles_provider_abstract__WEBPACK_IMPORTED_MODULE_0__.AbstractTileProvider {
    constructor(provider, factory, enabled = true) {
        super(factory, enabled);
        this.factory.withMetrics(provider.metrics).withNamespace(provider.name);
        this._contentProvider = provider;
    }
    _fetchContent(tile, callback) {
        return this._contentProvider.fetchContent(tile, callback);
    }
}
//# sourceMappingURL=tiles.provider.js.map

/***/ }),

/***/ "./dist/tiles/tiles.builder.js":
/*!*************************************!*\
  !*** ./dist/tiles/tiles.builder.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileBuilder: () => (/* binding */ TileBuilder)
/* harmony export */ });
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles */ "./dist/tiles/tiles.js");

class TileBuilder {
    static SharedBuilder() {
        return new TileBuilder();
    }
    get metrics() {
        return this._m;
    }
    get namespace() {
        return this._ns ?? "";
    }
    withNamespace(namespace) {
        this._ns = namespace;
        return this;
    }
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
    withType(type) {
        this._t = type;
        return this;
    }
    build() {
        const type = this._t ?? (_tiles__WEBPACK_IMPORTED_MODULE_0__.Tile);
        const t = new type(this._a?.x || 0, this._a?.y || 0, this._a?.levelOfDetail || this._m?.minLOD || 0, this._d || null);
        if (this._m) {
            t.geoBounds = _tiles__WEBPACK_IMPORTED_MODULE_0__.Tile.BuildEnvelope(t.address, this._m);
            t.bounds = _tiles__WEBPACK_IMPORTED_MODULE_0__.Tile.BuildBounds(t.address, this._m);
        }
        return t;
    }
}
//# sourceMappingURL=tiles.builder.js.map

/***/ }),

/***/ "./dist/tiles/tiles.client.js":
/*!************************************!*\
  !*** ./dist/tiles/tiles.client.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FetchError: () => (/* binding */ FetchError),
/* harmony export */   TileWebClient: () => (/* binding */ TileWebClient),
/* harmony export */   TileWebClientOptions: () => (/* binding */ TileWebClientOptions),
/* harmony export */   TileWebClientOptionsBuilder: () => (/* binding */ TileWebClientOptionsBuilder)
/* harmony export */ });
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _math_math__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../math/math */ "./dist/math/math.js");
/* harmony import */ var _address_tiles_address__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./address/tiles.address */ "./dist/tiles/address/tiles.address.js");



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
    constructor(name, urlFactory, codec, metrics, options) {
        if (!urlFactory) {
            throw new Error(`invalid url factory parameter ${urlFactory}`);
        }
        if (!codec) {
            throw new Error(`invalid codec parameter ${codec}`);
        }
        this._name = name;
        this._urlFactory = urlFactory;
        this._codec = codec;
        this._metrics = metrics;
        this._zindex = 0;
        this._o = { ...TileWebClientOptions.Default, ...options };
    }
    get name() {
        return this._name;
    }
    get zindex() {
        return this._zindex;
    }
    set zindex(v) {
        this._zindex = v;
    }
    get metrics() {
        return this._metrics;
    }
    async fetchAsync(request, env, ...userArgs) {
        if (!request) {
            throw new FetchError(`invalid request parameter.`);
        }
        if (_address_tiles_address__WEBPACK_IMPORTED_MODULE_0__.TileAddress.IsValidAddress(request, this._metrics) === false) {
            return _tiles_interfaces__WEBPACK_IMPORTED_MODULE_1__.FetchResult.Null(request, userArgs);
        }
        const url = this._urlFactory.buildUrl(request, ...userArgs);
        if (!url) {
            throw new FetchError(`Builded url of ${request.toString()} can not be null`);
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
                const r = new _tiles_interfaces__WEBPACK_IMPORTED_MODULE_1__.FetchResult(request, content, userArgs);
                r.status = response.status;
                r.statusText = response.statusText;
                return r;
            }
            catch (error) {
                console.log(`Error fetching ${url}: ${error}`);
            }
            const jitter = _math_math__WEBPACK_IMPORTED_MODULE_2__.Scalar.GetRandomInt(0, this._o.initialDelay || 1000);
            await new Promise((resolve) => setTimeout(resolve, delay + jitter));
            delay *= 2;
            retryCount++;
        } while (retryCount < maxRetry);
        throw new FetchError(`Exceeded maximum retries for URL: ${url}`, ...userArgs);
    }
}
//# sourceMappingURL=tiles.client.js.map

/***/ }),

/***/ "./dist/tiles/tiles.collection.js":
/*!****************************************!*\
  !*** ./dist/tiles/tiles.collection.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileCollection: () => (/* binding */ TileCollection)
/* harmony export */ });
/* harmony import */ var _geography_geography_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../geography/geography.interfaces */ "./dist/geography/geography.interfaces.js");
/* harmony import */ var _address_tiles_address__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./address/tiles.address */ "./dist/tiles/address/tiles.address.js");
/* harmony import */ var _geography_geography_envelope__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography/geography.envelope */ "./dist/geography/geography.envelope.js");
/* harmony import */ var _geometry_geometry_bounds__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geometry/geometry.bounds */ "./dist/geometry/geometry.bounds.js");




class TileCollection {
    static Empty() {
        return new TileCollection();
    }
    constructor(...items) {
        this._items = items;
    }
    get namespace() {
        return this._ns ?? "";
    }
    set namespace(ns) {
        this._ns = ns;
    }
    get count() {
        return this._items.length;
    }
    get index() {
        if (!this._index) {
            this._index = this._buildIndex();
        }
        return this._index;
    }
    get geoBounds() {
        if (!this._bounds) {
            this._bounds = this._buildBounds();
        }
        return this._bounds;
    }
    get bounds() {
        if (!this._rect) {
            this._rect = this._buildRect();
        }
        return this._rect;
    }
    has(address) {
        return this.index.has(address.quadkey);
    }
    get(address) {
        return this.index.get(address.quadkey);
    }
    getAll(...address) {
        return address.map((a) => this.get(a));
    }
    add(tile) {
        if (!this.has(tile.address)) {
            this._items.push(tile);
            this._index?.set(tile.quadkey, tile);
            const b = tile.geoBounds;
            if (b && this._bounds) {
                this._bounds.unionInPlace(b);
            }
            const r = tile.bounds;
            if (r && this._rect) {
                this._rect.unionInPlace(r);
            }
        }
    }
    addAll(...tiles) {
        for (const t of tiles) {
            this.add(t);
        }
    }
    remove(address) {
        if (this.has(address)) {
            const index = this._items.findIndex((t) => _address_tiles_address__WEBPACK_IMPORTED_MODULE_0__.TileAddress.IsEquals(t.address, address));
            this._items.splice(index, 1);
            this._bounds = undefined;
            this._rect = undefined;
            this._index?.delete(address.quadkey);
        }
    }
    removeAll(...address) {
        for (const a of address) {
            this.remove(a);
        }
    }
    clear() {
        this._items = [];
        this._bounds = undefined;
        this._rect = undefined;
    }
    intersect(bounds) {
        if (!bounds)
            return this[Symbol.iterator]();
        let pointer = 0;
        let items = this._items;
        if ((0,_geography_geography_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsEnvelope)(bounds)) {
            if (this.geoBounds?.intersects(bounds)) {
                return {
                    next() {
                        while (pointer < items.length) {
                            let item = items[pointer++];
                            let b = item.geoBounds;
                            if (!b || bounds.intersects(b)) {
                                return {
                                    done: false,
                                    value: item,
                                };
                            }
                        }
                        return {
                            done: true,
                            value: null,
                        };
                    },
                    [Symbol.iterator]() {
                        return this;
                    },
                };
            }
        }
        else {
            if (this.bounds?.intersects(bounds)) {
                return {
                    next() {
                        while (pointer < items.length) {
                            let item = items[pointer++];
                            let r = item.bounds;
                            if (!r || bounds.intersects(r)) {
                                return {
                                    done: false,
                                    value: item,
                                };
                            }
                        }
                        return {
                            done: true,
                            value: null,
                        };
                    },
                    [Symbol.iterator]() {
                        return this;
                    },
                };
            }
        }
        return {
            next() {
                return {
                    done: true,
                    value: null,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
    }
    [Symbol.iterator]() {
        let pointer = 0;
        let items = this._items;
        const iterator = {
            next() {
                if (pointer < items.length) {
                    return {
                        done: false,
                        value: items[pointer++],
                    };
                }
                return {
                    done: true,
                    value: null,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }
    _buildIndex() {
        const index = new Map();
        for (let i = 0; i < this._items.length; i++) {
            const t = this._items[i];
            index.set(t.quadkey, t);
        }
        return index;
    }
    _buildBounds() {
        return _geography_geography_envelope__WEBPACK_IMPORTED_MODULE_2__.Envelope.FromEnvelopes(...this._items);
    }
    _buildRect() {
        return _geometry_geometry_bounds__WEBPACK_IMPORTED_MODULE_3__.Bounds2.FromBounds(...this._items);
    }
}
//# sourceMappingURL=tiles.collection.js.map

/***/ }),

/***/ "./dist/tiles/tiles.interfaces.js":
/*!****************************************!*\
  !*** ./dist/tiles/tiles.interfaces.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CellCoordinateReference: () => (/* binding */ CellCoordinateReference),
/* harmony export */   FetchResult: () => (/* binding */ FetchResult),
/* harmony export */   IsArrayOfTile: () => (/* binding */ IsArrayOfTile),
/* harmony export */   IsArrayOfTileAddress: () => (/* binding */ IsArrayOfTileAddress),
/* harmony export */   IsTile: () => (/* binding */ IsTile),
/* harmony export */   IsTileAddress: () => (/* binding */ IsTileAddress),
/* harmony export */   IsTileCollection: () => (/* binding */ IsTileCollection),
/* harmony export */   IsTileDatasource: () => (/* binding */ IsTileDatasource),
/* harmony export */   IsTileMetricsProvider: () => (/* binding */ IsTileMetricsProvider),
/* harmony export */   IsTileSystemBounds: () => (/* binding */ IsTileSystemBounds)
/* harmony export */ });
function IsTileAddress(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.x !== undefined && b.y !== undefined && b.levelOfDetail !== undefined;
}
function IsArrayOfTileAddress(b) {
    if (Array.isArray(b) && b.length) {
        for (let i = 0; i != b.length; i++) {
            if (IsTileAddress(b[i])) {
                return true;
            }
        }
    }
    return false;
}
function IsTile(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return b.address !== undefined && b.content !== undefined;
}
function IsArrayOfTile(b) {
    if (Array.isArray(b) && b.length) {
        for (let i = 0; i != b.length; i++) {
            if (IsTile(b[i])) {
                return true;
            }
        }
    }
    return false;
}
function IsTileCollection(b) {
    if (typeof b !== "object" || b === null)
        return false;
    return (b.count !== undefined &&
        b.has !== undefined &&
        b.get !== undefined &&
        b.getAll !== undefined &&
        b.add !== undefined &&
        b.addAll !== undefined &&
        b.remove !== undefined &&
        b.removeAll !== undefined &&
        b.clear !== undefined &&
        b.intersect !== undefined);
}
var CellCoordinateReference;
(function (CellCoordinateReference) {
    CellCoordinateReference[CellCoordinateReference["CENTER"] = 0] = "CENTER";
    CellCoordinateReference[CellCoordinateReference["NW"] = 1] = "NW";
    CellCoordinateReference[CellCoordinateReference["NE"] = 2] = "NE";
    CellCoordinateReference[CellCoordinateReference["SW"] = 3] = "SW";
    CellCoordinateReference[CellCoordinateReference["SE"] = 4] = "SE";
})(CellCoordinateReference || (CellCoordinateReference = {}));
function IsTileSystemBounds(b) {
    if (b === null || typeof b !== "object")
        return false;
    return (b.minLOD !== undefined &&
        b.maxLOD !== undefined &&
        b.minLatitude !== undefined &&
        b.maxLatitude !== undefined &&
        b.minLongitude !== undefined &&
        b.maxLongitude !== undefined);
}
function IsTileMetricsProvider(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.metrics !== undefined;
}
class FetchResult {
    static Null(address, userArgs) {
        return new FetchResult(address, null, userArgs);
    }
    constructor(address, content, userArgs = null) {
        this.address = address;
        this.content = content;
        this.userArgs = userArgs;
        this.ok = true;
    }
}
function IsTileDatasource(b) {
    if (b === null || typeof b !== "object")
        return false;
    return b.fetchAsync !== undefined && b.metrics !== undefined;
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
/* harmony export */   Tile: () => (/* binding */ Tile)
/* harmony export */ });
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../geography */ "./dist/geography/geography.envelope.js");
/* harmony import */ var _geometry_geometry_bounds__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry/geometry.bounds */ "./dist/geometry/geometry.bounds.js");
/* harmony import */ var _address_tiles_address__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./address/tiles.address */ "./dist/tiles/address/tiles.address.js");



class Tile extends _address_tiles_address__WEBPACK_IMPORTED_MODULE_0__.TileAddress {
    static BuildEnvelope(a, metrics) {
        if (metrics) {
            const nw = metrics.getTileXYToLatLon(a.x, a.y, a.levelOfDetail);
            const se = metrics.getTileXYToLatLon(a.x + 1, a.y + 1, a.levelOfDetail);
            return _geography__WEBPACK_IMPORTED_MODULE_1__.Envelope.FromPoints(nw, se);
        }
        return undefined;
    }
    static BuildBounds(a, metrics) {
        if (metrics) {
            const p = metrics.getTileXYToPointXY(a.x, a.y);
            return new _geometry_geometry_bounds__WEBPACK_IMPORTED_MODULE_2__.Bounds2(p.x, p.y, metrics.tileSize, metrics.tileSize);
        }
        return undefined;
    }
    constructor(x, y, levelOfDetail, data = null, metrics) {
        super(x, y, levelOfDetail);
        this._value = data;
        if (metrics) {
            this._env = Tile.BuildEnvelope(this, metrics);
            this._rect = Tile.BuildBounds(this, metrics);
        }
    }
    get namespace() {
        return this._ns || "";
    }
    set namespace(v) {
        this._ns = v;
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
    get geoBounds() {
        return this._env;
    }
    set geoBounds(e) {
        this._env = e;
    }
    get bounds() {
        return this._rect;
    }
    set bounds(r) {
        this._rect = r;
    }
}
//# sourceMappingURL=tiles.js.map

/***/ }),

/***/ "./dist/tiles/tiles.metrics.js":
/*!*************************************!*\
  !*** ./dist/tiles/tiles.metrics.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractTileMetrics: () => (/* binding */ AbstractTileMetrics)
/* harmony export */ });
/* harmony import */ var _tiles_interfaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./tiles.interfaces */ "./dist/tiles/tiles.interfaces.js");
/* harmony import */ var _tiles_system__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.system */ "./dist/tiles/tiles.system.js");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../events */ "./dist/events/events.args.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geometry */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geography */ "./dist/geography/geography.position.js");





class AbstractTileMetrics extends _tiles_system__WEBPACK_IMPORTED_MODULE_0__.TileSystemBounds {
    constructor(options) {
        super(options);
        this._tileSize = AbstractTileMetrics.DefaultTileSize;
        this._cellSize = AbstractTileMetrics.DefaultCellSize;
        this._cellCoordinateReference = AbstractTileMetrics.DefaultCoordinateReference;
        this._overlap = AbstractTileMetrics.DefaultOverlap;
    }
    mapSize(levelOfDetail) {
        const result = this.tileSize * Math.pow(2, levelOfDetail);
        return result >>> 0;
    }
    get tileSize() {
        return this._tileSize;
    }
    set tileSize(v) {
        if (this._tileSize !== v) {
            const old = this._tileSize;
            this._tileSize = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "tileSize"), -1, this, this);
        }
    }
    get cellSize() {
        return this._cellSize;
    }
    set cellSize(v) {
        if (this._cellSize !== v) {
            const old = this._cellSize;
            this._cellSize = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "cellSize"), -1, this, this);
        }
    }
    get cellCoordinateReference() {
        return this._cellCoordinateReference;
    }
    set cellCoordinateReference(v) {
        if (this._cellCoordinateReference !== v) {
            const old = this._cellCoordinateReference;
            this._cellCoordinateReference = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "cellCoordinateReference"), -1, this, this);
        }
    }
    get overlap() {
        return this._overlap;
    }
    set overlap(v) {
        if (this._overlap !== v) {
            const old = this._overlap;
            this._overlap = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "overlap"), -1, this, this);
        }
    }
    mapScale(latitude, levelOfDetail, pixelPerUnit) {
        if (pixelPerUnit === 0)
            return Infinity;
        const d = this.groundResolution(latitude, levelOfDetail);
        if (d === 0)
            return Infinity;
        return 1 / (d * pixelPerUnit);
    }
    getLatLonToTileXY(latitude, longitude, levelOfDetail) {
        const c = _geometry__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.Zero();
        this.getLatLonToTileXYToRef(latitude, longitude, levelOfDetail, c);
        return c;
    }
    getTileXYToLatLon(x, y, levelOfDetail) {
        const g = _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2.Zero();
        this.getTileXYToLatLonToRef(x, y, levelOfDetail, g);
        return g;
    }
    getLatLonToPointXY(latitude, longitude, levelOfDetail) {
        const c = _geometry__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.Zero();
        this.getLatLonToPointXYToRef(latitude, longitude, levelOfDetail, c);
        return c;
    }
    getPointXYToLatLon(x, y, levelOfDetail) {
        const g = _geography__WEBPACK_IMPORTED_MODULE_3__.Geo2.Zero();
        this.getPointXYToLatLonToRef(x, y, levelOfDetail, g);
        return g;
    }
    getTileXYToPointXY(x, y) {
        const c = _geometry__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.Zero();
        this.getTileXYToPointXYToRef(x, y, c);
        return c;
    }
    getPointXYToTileXY(x, y) {
        const c = _geometry__WEBPACK_IMPORTED_MODULE_2__.Cartesian2.Zero();
        this.getPointXYToTileXYToRef(x, y, c);
        return c;
    }
}
AbstractTileMetrics.DefaultTileSize = 256;
AbstractTileMetrics.DefaultCellSize = 1;
AbstractTileMetrics.DefaultCoordinateReference = _tiles_interfaces__WEBPACK_IMPORTED_MODULE_4__.CellCoordinateReference.CENTER;
AbstractTileMetrics.DefaultOverlap = 0;
//# sourceMappingURL=tiles.metrics.js.map

/***/ }),

/***/ "./dist/tiles/tiles.system.js":
/*!************************************!*\
  !*** ./dist/tiles/tiles.system.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileSystemBounds: () => (/* binding */ TileSystemBounds)
/* harmony export */ });
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../geography */ "./dist/geography/geography.projections.js");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../events */ "./dist/events/events.observable.js");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../events */ "./dist/events/events.args.js");


class TileSystemBounds {
    static Intersection(bounds) {
        if (!bounds || bounds.length === 0) {
            return null;
        }
        const result = new TileSystemBounds();
        for (const bound of bounds) {
            result.intersectionInPlace(bound);
        }
        return result;
    }
    static Union(bounds) {
        const result = bounds[0].clone();
        for (let i = 1; i < bounds.length; i++) {
            result.unionInPlace(bounds[i]);
        }
        return result;
    }
    constructor(p) {
        this._minLOD = TileSystemBounds.DefaultMinLOD;
        this._maxLOD = TileSystemBounds.DefaultMaxLOD;
        this._minLatitude = TileSystemBounds.DefaultMinLatitude;
        this._maxLatitude = TileSystemBounds.DefaultMaxLatitude;
        this._minLongitude = TileSystemBounds.DefaultMinLongitude;
        this._maxLongitude = TileSystemBounds.DefaultMaxLongitude;
        if (p) {
            Object.assign(this, p);
        }
    }
    get propertyChangedObservable() {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new _events__WEBPACK_IMPORTED_MODULE_0__.Observable();
        }
        return this._propertyChangedObservable;
    }
    unionInPlace(bounds) {
        if (bounds) {
            this.minLOD = Math.min(this.minLOD, bounds.minLOD);
            this.maxLOD = Math.max(this.maxLOD, bounds.maxLOD);
            this.minLatitude = Math.min(this.minLatitude, bounds.minLatitude);
            this.maxLatitude = Math.max(this.maxLatitude, bounds.maxLatitude);
            this.minLongitude = Math.min(this.minLongitude, bounds.minLongitude);
            this.maxLongitude = Math.max(this.maxLongitude, bounds.maxLongitude);
        }
    }
    copyInPlace(bounds) {
        if (bounds) {
            this.minLOD = bounds.minLOD;
            this.maxLOD = bounds.maxLOD;
            this.minLatitude = bounds.minLatitude;
            this.maxLatitude = bounds.maxLatitude;
            this.minLongitude = bounds.minLongitude;
            this.maxLongitude = bounds.maxLongitude;
        }
    }
    clone() {
        return new TileSystemBounds(this);
    }
    intersectionInPlace(bounds) {
        if (bounds) {
            this.minLOD = Math.max(this.minLOD, bounds.minLOD);
            this.maxLOD = Math.min(this.maxLOD, bounds.maxLOD);
            this.minLatitude = Math.max(this.minLatitude, bounds.minLatitude);
            this.maxLatitude = Math.min(this.maxLatitude, bounds.maxLatitude);
            this.minLongitude = Math.max(this.minLongitude, bounds.minLongitude);
            this.maxLongitude = Math.min(this.maxLongitude, bounds.maxLongitude);
        }
    }
    get minLOD() {
        return this._minLOD;
    }
    set minLOD(v) {
        if (this._minLOD !== v) {
            const old = this._minLOD;
            this._minLOD = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "minLOD"), -1, this, this);
        }
    }
    get maxLOD() {
        return this._maxLOD;
    }
    set maxLOD(v) {
        if (this._maxLOD !== v) {
            const old = this._maxLOD;
            this._maxLOD = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "maxLOD"), -1, this, this);
        }
    }
    get minLatitude() {
        return this._minLatitude;
    }
    set minLatitude(v) {
        if (this._minLatitude !== v) {
            const old = this._minLatitude;
            this._minLatitude = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "minLatitude"), -1, this, this);
        }
    }
    get maxLatitude() {
        return this._maxLatitude;
    }
    set maxLatitude(v) {
        if (this._maxLatitude !== v) {
            const old = this._maxLatitude;
            this._maxLatitude = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "maxLatitude"), -1, this, this);
        }
    }
    get minLongitude() {
        return this._minLongitude;
    }
    set minLongitude(v) {
        if (this._minLongitude !== v) {
            const old = this._minLongitude;
            this._minLongitude = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "minLongitude"), -1, this, this);
        }
    }
    get maxLongitude() {
        return this._maxLongitude;
    }
    set maxLongitude(v) {
        if (this._maxLongitude !== v) {
            const old = this._maxLongitude;
            this._maxLongitude = v;
            this._propertyChangedObservable?.notifyObservers(new _events__WEBPACK_IMPORTED_MODULE_1__.PropertyChangedEventArgs(this, old, v, "maxLongitude"), -1, this, this);
        }
    }
}
TileSystemBounds.DefaultLOD = 0;
TileSystemBounds.DefaultMinLOD = 0;
TileSystemBounds.DefaultMaxLOD = 23;
TileSystemBounds.DefaultMinLatitude = _geography__WEBPACK_IMPORTED_MODULE_2__.Projections.WebMercatorMinLatitude;
TileSystemBounds.DefaultMaxLatitude = _geography__WEBPACK_IMPORTED_MODULE_2__.Projections.WebMercatorMaxLatitude;
TileSystemBounds.DefaultMinLongitude = -180;
TileSystemBounds.DefaultMaxLongitude = 180;
TileSystemBounds.Shared = new TileSystemBounds();
//# sourceMappingURL=tiles.system.js.map

/***/ }),

/***/ "./dist/tiles/tiles.urlBuilder.js":
/*!****************************************!*\
  !*** ./dist/tiles/tiles.urlBuilder.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   WebTileUrlBuilder: () => (/* binding */ WebTileUrlBuilder)
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

/***/ "./dist/tiles/vector/index.js":
/*!************************************!*\
  !*** ./dist/tiles/vector/index.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ShapeCollection: () => (/* reexport safe */ _tiles_vector_collection__WEBPACK_IMPORTED_MODULE_0__.ShapeCollection),
/* harmony export */   ShapeCollectionEventArgs: () => (/* reexport safe */ _tiles_vector_collection__WEBPACK_IMPORTED_MODULE_0__.ShapeCollectionEventArgs),
/* harmony export */   TileVectorRenderer: () => (/* reexport safe */ _tiles_vector_renderer__WEBPACK_IMPORTED_MODULE_2__.TileVectorRenderer),
/* harmony export */   VectorTileGeomType: () => (/* reexport safe */ _tiles_vector_interfaces__WEBPACK_IMPORTED_MODULE_1__.VectorTileGeomType)
/* harmony export */ });
/* harmony import */ var _tiles_vector_collection__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.vector.collection */ "./dist/tiles/vector/tiles.vector.collection.js");
/* harmony import */ var _tiles_vector_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.vector.interfaces */ "./dist/tiles/vector/tiles.vector.interfaces.js");
/* harmony import */ var _tiles_vector_renderer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.vector.renderer */ "./dist/tiles/vector/tiles.vector.renderer.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/vector/tiles.vector.collection.js":
/*!******************************************************!*\
  !*** ./dist/tiles/vector/tiles.vector.collection.js ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ShapeCollection: () => (/* binding */ ShapeCollection),
/* harmony export */   ShapeCollectionEventArgs: () => (/* binding */ ShapeCollectionEventArgs)
/* harmony export */ });
/* harmony import */ var _geography__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../geography */ "./dist/geography/shapes/geography.shapes.interfaces.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.bounds.collection.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _geometry_shapes_geometry_polygon__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../geometry/shapes/geometry.polygon */ "./dist/geometry/shapes/geometry.polygon.js");
/* harmony import */ var _geometry_shapes_geometry_polyline__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../geometry/shapes/geometry.polyline */ "./dist/geometry/shapes/geometry.polyline.js");
/* harmony import */ var _geometry_shapes_geometry_line__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../geometry/shapes/geometry.line */ "./dist/geometry/shapes/geometry.line.js");
/* harmony import */ var _geometry_geometry_simplify__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geometry/geometry.simplify */ "./dist/geometry/geometry.simplify.js");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../events */ "./dist/events/events.observable.js");







class ShapeCollectionEventArgs {
    constructor(lod, IShapes) {
        this.lod = lod;
        this.IShapes = IShapes;
    }
}
class ShapeCollection {
    constructor(metrics, simplifier) {
        this._metrics = metrics;
        this._shapes = new Array(metrics.maxLOD - metrics.minLOD + 1);
        this._simplifier = simplifier ?? new _geometry_geometry_simplify__WEBPACK_IMPORTED_MODULE_0__.PolylineSimplifier(ShapeCollection.DefaultSimplifyTolerance, ShapeCollection.DefaultSimplifyHighQuality);
    }
    get metrics() {
        return this._metrics;
    }
    get addedObservable() {
        if (this._addedObservable === undefined) {
            this._addedObservable = new _events__WEBPACK_IMPORTED_MODULE_1__.Observable();
        }
        return this._addedObservable;
    }
    get removedObservable() {
        if (this._removedObservable === undefined) {
            this._removedObservable = new _events__WEBPACK_IMPORTED_MODULE_1__.Observable();
        }
        return this._removedObservable;
    }
    get(lod) {
        if (lod < this._metrics.minLOD || lod > this._metrics.maxLOD) {
            return null;
        }
        return this._shapes[lod - this._metrics.minLOD];
    }
    trySet(lod, ...shapes) {
        let collection = this.get(lod);
        const views = shapes.map((s) => this._buildShape(s, lod, this.metrics)).filter((v) => v !== null);
        if (views.length === 0) {
            return false;
        }
        if (!collection) {
            collection = new _geometry__WEBPACK_IMPORTED_MODULE_2__.BoundedCollection();
            this._shapes[lod - this._metrics.minLOD] = collection;
        }
        collection.push(...views);
        if (this._addedObservable !== undefined && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers(new ShapeCollectionEventArgs(lod, views), -1, this, this);
        }
        return true;
    }
    _buildShape(shape, lod, metrics) {
        switch (shape.type) {
            case _geography__WEBPACK_IMPORTED_MODULE_3__.GeoShapeType.Polygon: {
                return this._buildPolygon(shape, lod, metrics);
            }
            case _geography__WEBPACK_IMPORTED_MODULE_3__.GeoShapeType.Line: {
                return this._buildLine(shape, lod, metrics);
            }
            case _geography__WEBPACK_IMPORTED_MODULE_3__.GeoShapeType.Polyline: {
                return this._buildPolyline(shape, lod, metrics);
            }
            default: {
                return null;
            }
        }
    }
    _buildPolygon(shape, lod, metrics) {
        const points = this._transform(shape.points, lod, metrics);
        return _geometry_shapes_geometry_polygon__WEBPACK_IMPORTED_MODULE_4__.Polygon.FromPoints(points);
    }
    _buildLine(shape, lod, metrics) {
        const a = _geometry__WEBPACK_IMPORTED_MODULE_5__.Cartesian3.Zero();
        const b = _geometry__WEBPACK_IMPORTED_MODULE_5__.Cartesian3.Zero();
        metrics.getLatLonToPointXYToRef(shape.start.lat, shape.start.lon, lod, a);
        metrics.getLatLonToPointXYToRef(shape.end.lat, shape.end.lon, lod, b);
        return this._filter(a, b) ? new _geometry_shapes_geometry_line__WEBPACK_IMPORTED_MODULE_6__.Line(a, b) : null;
    }
    _buildPolyline(shape, lod, metrics) {
        const points = this._transform(shape.points, lod, metrics);
        return this._filter(...points) ? _geometry_shapes_geometry_polyline__WEBPACK_IMPORTED_MODULE_7__.Polyline.FromPoints(points) : null;
    }
    _transform(geo, lod, metrics) {
        const result = geo.map((p) => {
            const ref = _geometry__WEBPACK_IMPORTED_MODULE_5__.Cartesian3.Zero();
            metrics.getLatLonToPointXYToRef(p.lat, p.lon, lod, ref);
            return ref;
        });
        if (result.length > 2 && this._simplifier) {
            return this._simplifier.simplify(result);
        }
        return result;
    }
    _filter(...args) {
        if (args.length < 2)
            return true;
        const p1 = args[0];
        const p2 = args[1];
        return _geometry__WEBPACK_IMPORTED_MODULE_5__.Cartesian3.Equals(p1, p2, ShapeCollection.Epsilon) == false;
    }
}
ShapeCollection.DefaultSimplifyTolerance = 2;
ShapeCollection.DefaultSimplifyHighQuality = false;
ShapeCollection.Epsilon = 1;
//# sourceMappingURL=tiles.vector.collection.js.map

/***/ }),

/***/ "./dist/tiles/vector/tiles.vector.interfaces.js":
/*!******************************************************!*\
  !*** ./dist/tiles/vector/tiles.vector.interfaces.js ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VectorTileGeomType: () => (/* binding */ VectorTileGeomType)
/* harmony export */ });
var VectorTileGeomType;
(function (VectorTileGeomType) {
    VectorTileGeomType[VectorTileGeomType["UNKNOWN"] = 0] = "UNKNOWN";
    VectorTileGeomType[VectorTileGeomType["POINT"] = 1] = "POINT";
    VectorTileGeomType[VectorTileGeomType["LINESTRING"] = 2] = "LINESTRING";
    VectorTileGeomType[VectorTileGeomType["POLYGON"] = 3] = "POLYGON";
})(VectorTileGeomType || (VectorTileGeomType = {}));
//# sourceMappingURL=tiles.vector.interfaces.js.map

/***/ }),

/***/ "./dist/tiles/vector/tiles.vector.renderer.js":
/*!****************************************************!*\
  !*** ./dist/tiles/vector/tiles.vector.renderer.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TileVectorRenderer: () => (/* binding */ TileVectorRenderer)
/* harmony export */ });
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.simplify.js");
/* harmony import */ var _tiles_vector_interfaces__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiles.vector.interfaces */ "./dist/tiles/vector/tiles.vector.interfaces.js");
/* harmony import */ var _tiles_vector_style_interface__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.vector.style.interface */ "./dist/tiles/vector/tiles.vector.style.interface.js");



class TileVectorRenderer {
    constructor(style, simplifier) {
        this._style = style;
        this._simplifier = simplifier ?? _geometry__WEBPACK_IMPORTED_MODULE_0__.PolylineSimplifier.Shared;
        this._orderedStyleLayers = this._prepareOrderedLayers(style);
    }
    renderTile(tile, ctx, w, h, style) {
        w = w ?? ctx.canvas.width;
        h = h ?? ctx.canvas.height;
        if (tile) {
            style = style ?? this._style;
            if (style) {
                if (style !== this._style) {
                    this._style = style;
                    this._orderedStyleLayers = this._prepareOrderedLayers(style);
                }
                if (this._orderedStyleLayers) {
                    for (const key of this._orderedStyleLayers) {
                        const styleLayer = style.layers[key];
                        const name = styleLayer.sourceLayer;
                        const layer = tile.layers[name];
                        if (layer && this._acceptLayer(name, layer, styleLayer)) {
                            this._drawLayer(ctx, name, layer, w, h, styleLayer);
                        }
                    }
                }
            }
        }
    }
    _prepareOrderedLayers(style) {
        if (!style) {
            return undefined;
        }
        const a = {};
        const defaultSlot = this._generateUniqueSlotName();
        const length = style.layers.length;
        for (let i = 0; i < length; i++) {
            const value = style.layers[i];
            if (!value) {
                continue;
            }
            const slot = value.slot ?? defaultSlot;
            let group = a[slot];
            if (!group) {
                a[slot] = group = [];
            }
            group.push(i);
        }
        return Object.values(a).flat();
    }
    _generateUniqueSlotName() {
        return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    _drawLayer(ctx, key, layer, w, h, styleLayer) {
        const extent = layer.extent;
        const scalex = w / extent;
        const scaley = h / extent;
        ctx.save();
        try {
            switch (styleLayer.type) {
                case _tiles_vector_style_interface__WEBPACK_IMPORTED_MODULE_1__.LayerStyleTypes.Fill: {
                    const paint = styleLayer.paint;
                    if (!paint) {
                        break;
                    }
                    const color = this._evaluate(paint.color);
                    const outlineColor = this._evaluate(paint.outlineColor);
                    if (!color && !outlineColor) {
                        break;
                    }
                    if (color) {
                        ctx.fillStyle = color;
                    }
                    if (outlineColor) {
                        ctx.strokeStyle = outlineColor;
                        ctx.lineWidth = TileVectorRenderer.DefaultLineWith;
                    }
                    const opacity = this._evaluate(paint.opacity) ?? TileVectorRenderer.DefaultOpacity;
                    ctx.globalAlpha = opacity;
                    const translate = this._evaluate(paint.translate);
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case _tiles_vector_interfaces__WEBPACK_IMPORTED_MODULE_2__.VectorTileGeomType.POLYGON: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley, translate);
                                    ctx.beginPath();
                                    this._drawPath(ctx, transformed[0]);
                                    if (transformed.length > 1) {
                                        for (let i = 1; i < transformed.length; i++) {
                                            this._drawPath(ctx, transformed[i]);
                                        }
                                    }
                                    ctx.fill();
                                    if (outlineColor) {
                                        ctx.stroke();
                                    }
                                    break;
                                }
                                default:
                                    break;
                            }
                        }
                    }
                    break;
                }
                case _tiles_vector_style_interface__WEBPACK_IMPORTED_MODULE_1__.LayerStyleTypes.Line: {
                    const paint = styleLayer.paint;
                    if (!paint) {
                        break;
                    }
                    const color = this._evaluate(paint.color);
                    if (!color) {
                        break;
                    }
                    ctx.strokeStyle = color;
                    const opacity = this._evaluate(paint.opacity) ?? TileVectorRenderer.DefaultOpacity;
                    ctx.globalAlpha = opacity;
                    const width = this._evaluate(paint.width);
                    ctx.lineWidth = width ?? TileVectorRenderer.DefaultLineWith;
                    const dasharray = this._evaluate(paint.dashArray);
                    if (dasharray) {
                        ctx.setLineDash(dasharray);
                    }
                    const translate = this._evaluate(paint.translate);
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case _tiles_vector_interfaces__WEBPACK_IMPORTED_MODULE_2__.VectorTileGeomType.POLYGON:
                                case _tiles_vector_interfaces__WEBPACK_IMPORTED_MODULE_2__.VectorTileGeomType.LINESTRING: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley, translate);
                                    for (const line of transformed) {
                                        ctx.beginPath();
                                        this._drawPath(ctx, line);
                                        ctx.stroke();
                                    }
                                    break;
                                }
                                default:
                                    break;
                            }
                        }
                    }
                    break;
                }
                case _tiles_vector_style_interface__WEBPACK_IMPORTED_MODULE_1__.LayerStyleTypes.Circle: {
                    const paint = styleLayer.paint;
                    if (!paint) {
                        break;
                    }
                    const color = this._evaluate(paint.color);
                    const outlineColor = this._evaluate(paint.strockeColor);
                    if (!color && !outlineColor) {
                        break;
                    }
                    if (color) {
                        ctx.fillStyle = color;
                    }
                    const opacity = this._evaluate(paint.opacity) ?? TileVectorRenderer.DefaultOpacity;
                    ctx.globalAlpha = opacity;
                    if (outlineColor) {
                        ctx.strokeStyle = outlineColor;
                        ctx.lineWidth = TileVectorRenderer.DefaultLineWith;
                    }
                    const translate = this._evaluate(paint.translate);
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case _tiles_vector_interfaces__WEBPACK_IMPORTED_MODULE_2__.VectorTileGeomType.POINT: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley, translate);
                                    for (const point of transformed) {
                                        ctx.beginPath();
                                        ctx.arc(point[0].x, point[0].y, paint.radius, 0, 2 * Math.PI);
                                        ctx.fill();
                                        if (outlineColor) {
                                            ctx.stroke();
                                        }
                                    }
                                    break;
                                }
                                default: {
                                    break;
                                }
                            }
                        }
                    }
                    break;
                }
                default: {
                    break;
                }
            }
        }
        finally {
            ctx.restore();
        }
    }
    _evaluate(p) {
        if ((0,_tiles_vector_style_interface__WEBPACK_IMPORTED_MODULE_1__.IsExpressionSpecification)(p)) {
            return this._evaluateExpression(p);
        }
        return p;
    }
    _evaluateExpression(p) {
        return undefined;
    }
    _getTransformedGeometry(feature, scalex, scaley, translate) {
        const geom = feature.loadGeometry();
        const transformed = [];
        for (let i = 0; i < geom.length; i++) {
            for (let j = 0; j < geom[i].length; j++) {
                if (translate) {
                    geom[i][j].x += translate[0];
                    geom[i][j].y += translate[1];
                }
                geom[i][j].x *= scalex;
                geom[i][j].y *= scaley;
            }
            transformed.push(this._simplifier.simplify(geom[i]));
        }
        return transformed;
    }
    _drawPolyline(ctx, points) {
        this._drawPath(ctx, points);
    }
    _drawPolygon(ctx, points) { }
    _drawPath(ctx, points) {
        let i = 0;
        let p = points[i];
        ctx.moveTo(p.x, p.y);
        if (i < points.length - 1) {
            do {
                p = points[++i];
                ctx.lineTo(p.x, p.y);
            } while (i < points.length - 1);
        }
    }
    _acceptLayer(key, layer, styleLayer) {
        return true;
    }
    _acceptFeature(layer, styleLayer) {
        return true;
    }
}
TileVectorRenderer.DefaultOpacity = 1.0;
TileVectorRenderer.DefaultLineWith = 1.0;
TileVectorRenderer.DefaultColor = "white";
//# sourceMappingURL=tiles.vector.renderer.js.map

/***/ }),

/***/ "./dist/tiles/vector/tiles.vector.style.interface.js":
/*!***********************************************************!*\
  !*** ./dist/tiles/vector/tiles.vector.style.interface.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsExpressionSpecification: () => (/* binding */ IsExpressionSpecification),
/* harmony export */   IsFillLayerStyle: () => (/* binding */ IsFillLayerStyle),
/* harmony export */   IsLineLayerStyle: () => (/* binding */ IsLineLayerStyle),
/* harmony export */   LayerStyleTypes: () => (/* binding */ LayerStyleTypes)
/* harmony export */ });
function IsExpressionSpecification(value) {
    return Array.isArray(value) && typeof value[0] === "string";
}
var LayerStyleTypes;
(function (LayerStyleTypes) {
    LayerStyleTypes["Fill"] = "fill";
    LayerStyleTypes["Line"] = "line";
    LayerStyleTypes["Circle"] = "circle";
    LayerStyleTypes["Background"] = "background";
})(LayerStyleTypes || (LayerStyleTypes = {}));
function IsFillLayerStyle(value) {
    return value && value.type === LayerStyleTypes.Fill;
}
function IsLineLayerStyle(value) {
    return value && value.type === LayerStyleTypes.Line;
}
//# sourceMappingURL=tiles.vector.style.interface.js.map

/***/ }),

/***/ "./dist/tiles/vendors/index.js":
/*!*************************************!*\
  !*** ./dist/tiles/vendors/index.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Google: () => (/* reexport safe */ _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_1__.Google),
/* harmony export */   GoogleMap2DLayerCode: () => (/* reexport safe */ _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_1__.GoogleMap2DLayerCode),
/* harmony export */   GoogleMap2DUrlBuilder: () => (/* reexport safe */ _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_1__.GoogleMap2DUrlBuilder),
/* harmony export */   MapZen: () => (/* reexport safe */ _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__.MapZen),
/* harmony export */   MapZenDemUrlBuilder: () => (/* reexport safe */ _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__.MapZenDemUrlBuilder),
/* harmony export */   MapZenNormalsDecoder: () => (/* reexport safe */ _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__.MapZenNormalsDecoder),
/* harmony export */   MapzenAltitudeDecoder: () => (/* reexport safe */ _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__.MapzenAltitudeDecoder)
/* harmony export */ });
/* harmony import */ var _tiles_vendors_mapzen__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.vendors.mapzen */ "./dist/tiles/vendors/tiles.vendors.mapzen.js");
/* harmony import */ var _tiles_vendors_google__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiles.vendors.google */ "./dist/tiles/vendors/tiles.vendors.google.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/vendors/tiles.vendors.google.js":
/*!****************************************************!*\
  !*** ./dist/tiles/vendors/tiles.vendors.google.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Google: () => (/* binding */ Google),
/* harmony export */   GoogleMap2DLayerCode: () => (/* binding */ GoogleMap2DLayerCode),
/* harmony export */   GoogleMap2DUrlBuilder: () => (/* binding */ GoogleMap2DUrlBuilder)
/* harmony export */ });
/* harmony import */ var _tiles_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../tiles.client */ "./dist/tiles/tiles.client.js");
/* harmony import */ var _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../codecs/tiles.codecs.image */ "./dist/tiles/codecs/tiles.codecs.image.js");
/* harmony import */ var _geography_tiles_geography_EPSG3857__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../geography/tiles.geography.EPSG3857 */ "./dist/tiles/geography/tiles.geography.EPSG3857.js");
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
            .withPath(`vt/lyrs=${types.join(",")}&x={x}&y={y}&z={z}`)
            .withSecure(true);
    }
}
GoogleMap2DUrlBuilder.Street = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.street);
GoogleMap2DUrlBuilder.Satellite = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite);
GoogleMap2DUrlBuilder.Hybrid = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite, GoogleMap2DLayerCode.hybrid);
GoogleMap2DUrlBuilder.Terrain = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.terrain);
class Google {
    static Client2d(urlBuilder, options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(`${Google.KEY}_2d`, urlBuilder, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static StreetClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(`${Google.KEY}_street2d`, GoogleMap2DUrlBuilder.Street, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static SatelliteClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(`${Google.KEY}_sat2d`, GoogleMap2DUrlBuilder.Satellite, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static HybridClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(`${Google.KEY}_hybrid2d`, GoogleMap2DUrlBuilder.Hybrid, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
    static TerrainClient2d(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_1__.TileWebClient(`${Google.KEY}_terrain2d`, GoogleMap2DUrlBuilder.Terrain, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_2__.ImageTileCodec(), Google.Metrics, options);
    }
}
Google.KEY = "google";
Google.MaxLevelOfDetail = 20;
Google.Metrics = new _geography_tiles_geography_EPSG3857__WEBPACK_IMPORTED_MODULE_3__.EPSG3857({ maxLOD: Google.MaxLevelOfDetail });
Google.Attribution = "Map data © Google";
//# sourceMappingURL=tiles.vendors.google.js.map

/***/ }),

/***/ "./dist/tiles/vendors/tiles.vendors.mapzen.js":
/*!****************************************************!*\
  !*** ./dist/tiles/vendors/tiles.vendors.mapzen.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MapZen: () => (/* binding */ MapZen),
/* harmony export */   MapZenDemUrlBuilder: () => (/* binding */ MapZenDemUrlBuilder),
/* harmony export */   MapZenNormalsDecoder: () => (/* binding */ MapZenNormalsDecoder),
/* harmony export */   MapzenAltitudeDecoder: () => (/* binding */ MapzenAltitudeDecoder)
/* harmony export */ });
/* harmony import */ var _tiles_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../tiles.client */ "./dist/tiles/tiles.client.js");
/* harmony import */ var _tiles_urlBuilder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../tiles.urlBuilder */ "./dist/tiles/tiles.urlBuilder.js");
/* harmony import */ var _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../codecs/tiles.codecs.image */ "./dist/tiles/codecs/tiles.codecs.image.js");
/* harmony import */ var _geography_tiles_geography_EPSG3857__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../geography/tiles.geography.EPSG3857 */ "./dist/tiles/geography/tiles.geography.EPSG3857.js");
/* harmony import */ var _dem_dem_tileclient__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../dem/dem.tileclient */ "./dist/dem/dem.tileclient.js");
/* harmony import */ var _codecs_tiles_codecs_interfaces__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../codecs/tiles.codecs.interfaces */ "./dist/tiles/codecs/tiles.codecs.interfaces.js");
/* harmony import */ var _geometry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../geometry */ "./dist/geometry/geometry.cartesian.js");
/* harmony import */ var _codecs_tiles_codecs_cartesian__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../codecs/tiles.codecs.cartesian */ "./dist/tiles/codecs/tiles.codecs.cartesian.js");








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
class MapZenNormalsDecoder {
    decode(pixels, offset, target, targetOffset) {
        let v = target[targetOffset];
        if (!v) {
            v = target[targetOffset] = _geometry__WEBPACK_IMPORTED_MODULE_1__.Cartesian4.Zero();
        }
        v.x = pixels[offset++];
        v.y = pixels[offset++];
        v.z = pixels[offset++];
        v.w = pixels[offset];
        return targetOffset + 1;
    }
}
MapZenNormalsDecoder.Shared = new MapZenNormalsDecoder();
class MapZen {
    static ElevationsImagesClient(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_2__.TileWebClient(`${MapZen.KEY}_terrarium`, MapZenDemUrlBuilder.Terrarium, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__.ImageTileCodec(), MapZen.Metrics, options);
    }
    static ElevationsClient(options) {
        const o = (0,_codecs_tiles_codecs_interfaces__WEBPACK_IMPORTED_MODULE_4__.isFilter)(options?.filter) ? new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__.Float32TileCodecOptions({ filter: options?.filter }) : undefined;
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_2__.TileWebClient(`${MapZen.KEY}_terrarium_float`, MapZenDemUrlBuilder.Terrarium, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__.Float32TileCodec(MapzenAltitudeDecoder.Shared, o), MapZen.Metrics, options);
    }
    static NormalsImagesClient(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_2__.TileWebClient(`${MapZen.KEY}_normal`, MapZenDemUrlBuilder.Normal, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__.ImageTileCodec(), MapZen.Metrics, options);
    }
    static NormalsUint8ArrayClient(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_2__.TileWebClient(`${MapZen.KEY}_normal`, MapZenDemUrlBuilder.Normal, new _codecs_tiles_codecs_image__WEBPACK_IMPORTED_MODULE_3__.ImageDataTileCodec(), MapZen.Metrics, options);
    }
    static NormalsCartesian4Client(options) {
        return new _tiles_client__WEBPACK_IMPORTED_MODULE_2__.TileWebClient(`${MapZen.KEY}_normal_Cartesian4`, MapZenDemUrlBuilder.Normal, new _codecs_tiles_codecs_cartesian__WEBPACK_IMPORTED_MODULE_5__.Cartesian4TileCodec(MapZenNormalsDecoder.Shared), MapZen.Metrics, options);
    }
    static DemClient(optionsElevations, optionsNormals) {
        return new _dem_dem_tileclient__WEBPACK_IMPORTED_MODULE_6__.DemTileWebClient(`${MapZen.KEY}_dem`, MapZen.ElevationsClient(optionsElevations), MapZen.NormalsImagesClient(optionsNormals));
    }
}
MapZen.KEY = "mapzen";
MapZen.MaxLevelOfDetail = 15;
MapZen.Metrics = new _geography_tiles_geography_EPSG3857__WEBPACK_IMPORTED_MODULE_7__.EPSG3857({ maxLOD: MapZen.MaxLevelOfDetail });
MapZen.Attribution = "Freely provided by MapZen - with thanks.";
//# sourceMappingURL=tiles.vendors.mapzen.js.map

/***/ }),

/***/ "./dist/types.js":
/*!***********************!*\
  !*** ./dist/types.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsDisposable: () => (/* binding */ IsDisposable),
/* harmony export */   IsNumber: () => (/* binding */ IsNumber),
/* harmony export */   isArrayOfFloatArray: () => (/* binding */ isArrayOfFloatArray),
/* harmony export */   isFloatArray: () => (/* binding */ isFloatArray),
/* harmony export */   isValidable: () => (/* binding */ isValidable)
/* harmony export */ });
function isFloatArray(input) {
    if (Array.isArray(input)) {
        return input.every((item) => typeof item === "number");
    }
    return input instanceof Float32Array;
}
function isArrayOfFloatArray(input) {
    if (!Array.isArray(input)) {
        return false;
    }
    return input.every(isFloatArray);
}
function IsDisposable(obj) {
    if (typeof obj !== "object" || obj === null)
        return false;
    return obj.dispose !== undefined;
}
function isValidable(obj) {
    if (typeof obj !== "object" || obj === null)
        return false;
    return obj.validate !== undefined && obj.invalidate !== undefined;
}
function IsNumber(value) {
    return typeof value === "number" && !Number.isNaN(value);
}
//# sourceMappingURL=types.js.map

/***/ }),

/***/ "./dist/utils/index.js":
/*!*****************************!*\
  !*** ./dist/utils/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Assert: () => (/* reexport safe */ _runtime__WEBPACK_IMPORTED_MODULE_2__.Assert),
/* harmony export */   ObjectPool: () => (/* reexport safe */ _objectpools__WEBPACK_IMPORTED_MODULE_0__.ObjectPool),
/* harmony export */   ObjectPoolOptions: () => (/* reexport safe */ _objectpools__WEBPACK_IMPORTED_MODULE_0__.ObjectPoolOptions),
/* harmony export */   TextUtils: () => (/* reexport safe */ _text__WEBPACK_IMPORTED_MODULE_1__.TextUtils)
/* harmony export */ });
/* harmony import */ var _objectpools__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./objectpools */ "./dist/utils/objectpools.js");
/* harmony import */ var _text__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./text */ "./dist/utils/text.js");
/* harmony import */ var _runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./runtime */ "./dist/utils/runtime.js");



//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/utils/objectpools.js":
/*!***********************************!*\
  !*** ./dist/utils/objectpools.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ObjectPool: () => (/* binding */ ObjectPool),
/* harmony export */   ObjectPoolOptions: () => (/* binding */ ObjectPoolOptions)
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

/***/ }),

/***/ "./dist/utils/runtime.js":
/*!*******************************!*\
  !*** ./dist/utils/runtime.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Assert: () => (/* binding */ Assert)
/* harmony export */ });
function Assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}
//# sourceMappingURL=runtime.js.map

/***/ }),

/***/ "./dist/utils/text.js":
/*!****************************!*\
  !*** ./dist/utils/text.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TextUtils: () => (/* binding */ TextUtils)
/* harmony export */ });
class TextUtils {
    static BuildNameWithSuffix(name, suffix) {
        return `${name}.${suffix}`;
    }
}
//# sourceMappingURL=text.js.map

/***/ }),

/***/ "./dist/validable.js":
/*!***************************!*\
  !*** ./dist/validable.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ValidableBase: () => (/* binding */ ValidableBase)
/* harmony export */ });
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./events */ "./dist/events/events.observable.js");

class ValidableBase {
    constructor() {
        this._valid = true;
    }
    get isValid() {
        return this._valid;
    }
    get validationObservable() {
        if (!this._validationObservable) {
            this._validationObservable = new _events__WEBPACK_IMPORTED_MODULE_0__.Observable();
        }
        return this._validationObservable;
    }
    invalidate() {
        if (this.isValid) {
            this._doInvalidateInternal();
        }
    }
    validate(force) {
        if (!this.isValid || force) {
            this._doValidateInternal();
        }
    }
    revalidate() {
        this.invalidate();
        this.validate();
    }
    _doInvalidateInternal() {
        this._beforeInvalidate();
        this._valid = false;
        this._doInvalidate();
        if (this._validationObservable && this._validationObservable.hasObservers()) {
            this._validationObservable.notifyObservers(false, -1, this, this);
        }
        this._afterInvalidate();
    }
    _doValidateInternal() {
        this._beforeValidate();
        this._valid = true;
        this._doValidate();
        if (this._validationObservable && this._validationObservable.hasObservers()) {
            this._validationObservable.notifyObservers(true, -1, this, this);
        }
        this._afterValidate();
    }
    dispose() {
        this._validationObservable?.clear();
    }
    _beforeInvalidate() {
    }
    _doInvalidate() {
    }
    _afterInvalidate() {
    }
    _beforeValidate() {
    }
    _doValidate() {
    }
    _afterValidate() {
    }
}
//# sourceMappingURL=validable.js.map

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
/* harmony export */   AbstractRange: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.AbstractRange),
/* harmony export */   AbstractShape: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.AbstractShape),
/* harmony export */   AbstractTileMetrics: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.AbstractTileMetrics),
/* harmony export */   AbstractTileProvider: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.AbstractTileProvider),
/* harmony export */   Angle: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Angle),
/* harmony export */   Assert: () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_11__.Assert),
/* harmony export */   AxialTilt: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.AxialTilt),
/* harmony export */   Bearing: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.Bearing),
/* harmony export */   BlobTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.BlobTileCodec),
/* harmony export */   Bounded: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Bounded),
/* harmony export */   BoundedCollection: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.BoundedCollection),
/* harmony export */   Bounds2: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Bounds2),
/* harmony export */   CacheEntry: () => (/* reexport safe */ _cache_index__WEBPACK_IMPORTED_MODULE_12__.CacheEntry),
/* harmony export */   CacheEntryOptions: () => (/* reexport safe */ _cache_index__WEBPACK_IMPORTED_MODULE_12__.CacheEntryOptions),
/* harmony export */   CacheEntryOptionsBuilder: () => (/* reexport safe */ _cache_index__WEBPACK_IMPORTED_MODULE_12__.CacheEntryOptionsBuilder),
/* harmony export */   CachePolicy: () => (/* reexport safe */ _cache_index__WEBPACK_IMPORTED_MODULE_12__.CachePolicy),
/* harmony export */   CachePolicyBuilder: () => (/* reexport safe */ _cache_index__WEBPACK_IMPORTED_MODULE_12__.CachePolicyBuilder),
/* harmony export */   CalculatorBase: () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_3__.CalculatorBase),
/* harmony export */   CanvasDisplay: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.CanvasDisplay),
/* harmony export */   CanvasMap: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.CanvasMap),
/* harmony export */   CanvasTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.CanvasTileCodec),
/* harmony export */   Cartesian2: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Cartesian2),
/* harmony export */   Cartesian2WithInfos: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.Cartesian2WithInfos),
/* harmony export */   Cartesian3: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Cartesian3),
/* harmony export */   Cartesian4: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Cartesian4),
/* harmony export */   Cartesian4TileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Cartesian4TileCodec),
/* harmony export */   Cartesian4TileCodecOptions: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Cartesian4TileCodecOptions),
/* harmony export */   CartesianMode: () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_3__.CartesianMode),
/* harmony export */   CelestialNodeType: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.CelestialNodeType),
/* harmony export */   CelestialTracker: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.CelestialTracker),
/* harmony export */   CellCoordinateReference: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.CellCoordinateReference),
/* harmony export */   Circle: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Circle),
/* harmony export */   ColorValue: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.ColorValue),
/* harmony export */   Context2DTileMap: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.Context2DTileMap),
/* harmony export */   Current: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Current),
/* harmony export */   DemInfos: () => (/* reexport safe */ _dem_index__WEBPACK_IMPORTED_MODULE_13__.DemInfos),
/* harmony export */   DemTileWebClient: () => (/* reexport safe */ _dem_index__WEBPACK_IMPORTED_MODULE_13__.DemTileWebClient),
/* harmony export */   Display: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Display),
/* harmony export */   EPSG3857: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.EPSG3857),
/* harmony export */   Ellipsoid: () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_3__.Ellipsoid),
/* harmony export */   Envelope: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.Envelope),
/* harmony export */   EquatorialVector: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.EquatorialVector),
/* harmony export */   EventArgs: () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_2__.EventArgs),
/* harmony export */   EventEmitter: () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_2__.EventEmitter),
/* harmony export */   EventState: () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_2__.EventState),
/* harmony export */   EvictionReason: () => (/* reexport safe */ _cache_index__WEBPACK_IMPORTED_MODULE_12__.EvictionReason),
/* harmony export */   FetchError: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.FetchError),
/* harmony export */   FetchResult: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.FetchResult),
/* harmony export */   Float32Layer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Float32Layer),
/* harmony export */   Float32TileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Float32TileCodec),
/* harmony export */   Float32TileCodecOptions: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Float32TileCodecOptions),
/* harmony export */   Float32TileCodecOptionsBuilder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Float32TileCodecOptionsBuilder),
/* harmony export */   Geo2: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.Geo2),
/* harmony export */   Geo3: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.Geo3),
/* harmony export */   GeoBounded: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.GeoBounded),
/* harmony export */   GeoBoundedCollection: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.GeoBoundedCollection),
/* harmony export */   GeoLine: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.GeoLine),
/* harmony export */   GeoPolygon: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.GeoPolygon),
/* harmony export */   GeoPolyline: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.GeoPolyline),
/* harmony export */   GeoShape: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.GeoShape),
/* harmony export */   GeoShapeType: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.GeoShapeType),
/* harmony export */   GeodeticSystem: () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_3__.GeodeticSystem),
/* harmony export */   Google: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Google),
/* harmony export */   GoogleMap2DLayerCode: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.GoogleMap2DLayerCode),
/* harmony export */   GoogleMap2DUrlBuilder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.GoogleMap2DUrlBuilder),
/* harmony export */   HSLColor: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.HSLColor),
/* harmony export */   HorizonVector: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.HorizonVector),
/* harmony export */   ImageDataTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.ImageDataTileCodec),
/* harmony export */   ImageDataTileCodecOptions: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.ImageDataTileCodecOptions),
/* harmony export */   ImageDataTileCodecOptionsBuilder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.ImageDataTileCodecOptionsBuilder),
/* harmony export */   ImageLayer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.ImageLayer),
/* harmony export */   ImageTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.ImageTileCodec),
/* harmony export */   InputControllerBase: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.InputControllerBase),
/* harmony export */   InputsNavigationTarget: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.InputsNavigationTarget),
/* harmony export */   IsArrayOfTile: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsArrayOfTile),
/* harmony export */   IsArrayOfTileAddress: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsArrayOfTileAddress),
/* harmony export */   IsBounds: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.IsBounds),
/* harmony export */   IsDemInfos: () => (/* reexport safe */ _dem_index__WEBPACK_IMPORTED_MODULE_13__.IsDemInfos),
/* harmony export */   IsDisposable: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_0__.IsDisposable),
/* harmony export */   IsDrawableTileMapLayer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsDrawableTileMapLayer),
/* harmony export */   IsEnvelope: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.IsEnvelope),
/* harmony export */   IsGeoBounded: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.IsGeoBounded),
/* harmony export */   IsLocation: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.IsLocation),
/* harmony export */   IsNumber: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_0__.IsNumber),
/* harmony export */   IsSize: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.IsSize),
/* harmony export */   IsSize3: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.IsSize3),
/* harmony export */   IsTargetBlock: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTargetBlock),
/* harmony export */   IsTile: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTile),
/* harmony export */   IsTileAddress: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileAddress),
/* harmony export */   IsTileCollection: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileCollection),
/* harmony export */   IsTileDatasource: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileDatasource),
/* harmony export */   IsTileMapLayer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileMapLayer),
/* harmony export */   IsTileMapLayerContainerProxy: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileMapLayerContainerProxy),
/* harmony export */   IsTileMapLayerProxy: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileMapLayerProxy),
/* harmony export */   IsTileMetricsProvider: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileMetricsProvider),
/* harmony export */   IsTileMipMapping: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileMipMapping),
/* harmony export */   IsTileNavigationApi: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileNavigationApi),
/* harmony export */   IsTileNavigationState: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileNavigationState),
/* harmony export */   IsTileSystemBounds: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.IsTileSystemBounds),
/* harmony export */   JsonTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.JsonTileCodec),
/* harmony export */   JulianDate: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.JulianDate),
/* harmony export */   KeplerOrbitBase: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.KeplerOrbitBase),
/* harmony export */   KnownPlaces: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.KnownPlaces),
/* harmony export */   Length: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Length),
/* harmony export */   Line: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Line),
/* harmony export */   Luminosity: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Luminosity),
/* harmony export */   MapZen: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.MapZen),
/* harmony export */   MapZenDemUrlBuilder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.MapZenDemUrlBuilder),
/* harmony export */   MapZenNormalsDecoder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.MapZenNormalsDecoder),
/* harmony export */   MapzenAltitudeDecoder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.MapzenAltitudeDecoder),
/* harmony export */   Mass: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Mass),
/* harmony export */   MedianFilter: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.MedianFilter),
/* harmony export */   MemoryCache: () => (/* reexport safe */ _cache_index__WEBPACK_IMPORTED_MODULE_12__.MemoryCache),
/* harmony export */   MoonState: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.MoonState),
/* harmony export */   MorganKeenanClass: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.MorganKeenanClass),
/* harmony export */   MouseInputController: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.MouseInputController),
/* harmony export */   ObjectPool: () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_11__.ObjectPool),
/* harmony export */   ObjectPoolOptions: () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_11__.ObjectPoolOptions),
/* harmony export */   Observable: () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_2__.Observable),
/* harmony export */   Observer: () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_2__.Observer),
/* harmony export */   PlaneCruncher: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.PlaneCruncher),
/* harmony export */   PlaneDefinition: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.PlaneDefinition),
/* harmony export */   Point: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Point),
/* harmony export */   PointerController: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.PointerController),
/* harmony export */   PointerInputController: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.PointerInputController),
/* harmony export */   Polygon: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Polygon),
/* harmony export */   Polyline: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Polyline),
/* harmony export */   PolylineSimplifier: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.PolylineSimplifier),
/* harmony export */   Power: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Power),
/* harmony export */   Projections: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.Projections),
/* harmony export */   PropertyChangedEventArgs: () => (/* reexport safe */ _events_index__WEBPACK_IMPORTED_MODULE_2__.PropertyChangedEventArgs),
/* harmony export */   PythagoreanFlatEarthCalculator: () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_3__.PythagoreanFlatEarthCalculator),
/* harmony export */   Quantity: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Quantity),
/* harmony export */   QuantityRange: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.QuantityRange),
/* harmony export */   QuickHull: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.QuickHull),
/* harmony export */   RGBAColor: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.RGBAColor),
/* harmony export */   RGBATileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.RGBATileCodec),
/* harmony export */   RGBTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.RGBTileCodec),
/* harmony export */   Range: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Range),
/* harmony export */   RegionCode: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.RegionCode),
/* harmony export */   Scalar: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Scalar),
/* harmony export */   ShapeCollection: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.ShapeCollection),
/* harmony export */   ShapeCollectionEventArgs: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.ShapeCollectionEventArgs),
/* harmony export */   ShapeType: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.ShapeType),
/* harmony export */   Side: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Side),
/* harmony export */   Size2: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Size2),
/* harmony export */   Size3: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.Size3),
/* harmony export */   SpectralClass: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.SpectralClass),
/* harmony export */   Speed: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Speed),
/* harmony export */   SphericalCalculator: () => (/* reexport safe */ _geodesy_index__WEBPACK_IMPORTED_MODULE_3__.SphericalCalculator),
/* harmony export */   StarColor: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.StarColor),
/* harmony export */   SunTrajectoryConfig: () => (/* reexport safe */ _space_index__WEBPACK_IMPORTED_MODULE_9__.SunTrajectoryConfig),
/* harmony export */   Temperature: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Temperature),
/* harmony export */   TerrainGridOptions: () => (/* reexport safe */ _meshes_index__WEBPACK_IMPORTED_MODULE_8__.TerrainGridOptions),
/* harmony export */   TerrainGridOptionsBuilder: () => (/* reexport safe */ _meshes_index__WEBPACK_IMPORTED_MODULE_8__.TerrainGridOptionsBuilder),
/* harmony export */   TerrainNormalizedGridBuilder: () => (/* reexport safe */ _meshes_index__WEBPACK_IMPORTED_MODULE_8__.TerrainNormalizedGridBuilder),
/* harmony export */   TextTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TextTileCodec),
/* harmony export */   TextUtils: () => (/* reexport safe */ _utils_index__WEBPACK_IMPORTED_MODULE_11__.TextUtils),
/* harmony export */   Tile: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.Tile),
/* harmony export */   TileAddress: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileAddress),
/* harmony export */   TileCollection: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileCollection),
/* harmony export */   TileContentProvider: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileContentProvider),
/* harmony export */   TileMapBase: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileMapBase),
/* harmony export */   TileMapLayer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileMapLayer),
/* harmony export */   TileMapLayerView: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileMapLayerView),
/* harmony export */   TileMapVectorLayer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileMapVectorLayer),
/* harmony export */   TileNavigationState: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileNavigationState),
/* harmony export */   TileNavigationStateSynchronizer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileNavigationStateSynchronizer),
/* harmony export */   TilePipelineLink: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TilePipelineLink),
/* harmony export */   TileProvider: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileProvider),
/* harmony export */   TileSystemBounds: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileSystemBounds),
/* harmony export */   TileVectorRenderer: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileVectorRenderer),
/* harmony export */   TileView: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileView),
/* harmony export */   TileWebClient: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileWebClient),
/* harmony export */   TileWebClientOptions: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileWebClientOptions),
/* harmony export */   TileWebClientOptionsBuilder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.TileWebClientOptionsBuilder),
/* harmony export */   Timespan: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Timespan),
/* harmony export */   Unit: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Unit),
/* harmony export */   ValidableBase: () => (/* reexport safe */ _validable__WEBPACK_IMPORTED_MODULE_1__.ValidableBase),
/* harmony export */   VectorTileGeomType: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.VectorTileGeomType),
/* harmony export */   Voltage: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Voltage),
/* harmony export */   Volume: () => (/* reexport safe */ _math_index__WEBPACK_IMPORTED_MODULE_7__.Volume),
/* harmony export */   WebTileUrlBuilder: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.WebTileUrlBuilder),
/* harmony export */   XmlDocumentTileCodec: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.XmlDocumentTileCodec),
/* harmony export */   hasNavigationApi: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.hasNavigationApi),
/* harmony export */   hasNavigationState: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.hasNavigationState),
/* harmony export */   hasTileSelectionContext: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.hasTileSelectionContext),
/* harmony export */   isArrayOfCartesianArray: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isArrayOfCartesianArray),
/* harmony export */   isArrayOfFloatArray: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_0__.isArrayOfFloatArray),
/* harmony export */   isCartesian: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isCartesian),
/* harmony export */   isCartesian3: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isCartesian3),
/* harmony export */   isCartesian4: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isCartesian4),
/* harmony export */   isCartesianArray: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isCartesianArray),
/* harmony export */   isCircle: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isCircle),
/* harmony export */   isClipable: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isClipable),
/* harmony export */   isFilter: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.isFilter),
/* harmony export */   isFloatArray: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_0__.isFloatArray),
/* harmony export */   isGeoShape: () => (/* reexport safe */ _geography_index__WEBPACK_IMPORTED_MODULE_4__.isGeoShape),
/* harmony export */   isLine: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isLine),
/* harmony export */   isPolygon: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isPolygon),
/* harmony export */   isPolyline: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isPolyline),
/* harmony export */   isShape: () => (/* reexport safe */ _geometry_index__WEBPACK_IMPORTED_MODULE_5__.isShape),
/* harmony export */   isSupportingTouch: () => (/* reexport safe */ _map_index__WEBPACK_IMPORTED_MODULE_6__.isSupportingTouch),
/* harmony export */   isValidable: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_0__.isValidable),
/* harmony export */   isViewProxy: () => (/* reexport safe */ _tiles_index__WEBPACK_IMPORTED_MODULE_10__.isViewProxy)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./types */ "./dist/types.js");
/* harmony import */ var _validable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./validable */ "./dist/validable.js");
/* harmony import */ var _events_index__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./events/index */ "./dist/events/index.js");
/* harmony import */ var _geodesy_index__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./geodesy/index */ "./dist/geodesy/index.js");
/* harmony import */ var _geography_index__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./geography/index */ "./dist/geography/index.js");
/* harmony import */ var _geometry_index__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./geometry/index */ "./dist/geometry/index.js");
/* harmony import */ var _map_index__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./map/index */ "./dist/map/index.js");
/* harmony import */ var _math_index__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./math/index */ "./dist/math/index.js");
/* harmony import */ var _meshes_index__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./meshes/index */ "./dist/meshes/index.js");
/* harmony import */ var _space_index__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./space/index */ "./dist/space/index.js");
/* harmony import */ var _tiles_index__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./tiles/index */ "./dist/tiles/index.js");
/* harmony import */ var _utils_index__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./utils/index */ "./dist/utils/index.js");
/* harmony import */ var _cache_index__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./cache/index */ "./dist/cache/index.js");
/* harmony import */ var _dem_index__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./dem/index */ "./dist/dem/index.js");














//# sourceMappingURL=index.js.map
})();

SPACEXR = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=spacexr.1.0.0.js.map