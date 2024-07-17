var SPACEXR_MAPBOX;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dist/tiles/codecs/index.js":
/*!************************************!*\
  !*** ./dist/tiles/codecs/index.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VectorTileCodec: () => (/* reexport safe */ _tiles_codecs_vector__WEBPACK_IMPORTED_MODULE_0__.VectorTileCodec)
/* harmony export */ });
/* harmony import */ var _tiles_codecs_vector__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.codecs.vector */ "./dist/tiles/codecs/tiles.codecs.vector.js");

//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/codecs/tiles.codecs.vector.js":
/*!**************************************************!*\
  !*** ./dist/tiles/codecs/tiles.codecs.vector.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VectorTileCodec: () => (/* binding */ VectorTileCodec)
/* harmony export */ });
/* harmony import */ var _mapbox_vector_tile__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @mapbox/vector-tile */ "../../../../node_modules/@mapbox/vector-tile/index.js");
/* harmony import */ var pbf__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! pbf */ "../../../../node_modules/pbf/index.js");
/* harmony import */ var core_tiles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core/tiles */ "core/tiles");
/* harmony import */ var core_tiles__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_tiles__WEBPACK_IMPORTED_MODULE_2__);



class VectorTileCodec extends core_tiles__WEBPACK_IMPORTED_MODULE_2__.CanvasTileCodec {
    static CreateCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    constructor(metrics, render) {
        super(VectorTileCodec.CreateCanvas(metrics.tileSize, metrics.tileSize));
        if (render instanceof core_tiles__WEBPACK_IMPORTED_MODULE_2__.TileVectorRenderer) {
            this._renderer = render;
        }
        else {
            this._renderer = new core_tiles__WEBPACK_IMPORTED_MODULE_2__.TileVectorRenderer(render);
        }
    }
    async _decodeDataAsync(r) {
        const b = await r.blob();
        if (b) {
            return new _mapbox_vector_tile__WEBPACK_IMPORTED_MODULE_0__.VectorTile(new pbf__WEBPACK_IMPORTED_MODULE_1__["default"](await b.arrayBuffer()));
        }
        return null;
    }
    _render(ctx, tile, style) {
        this._renderer.renderTile(tile, ctx, style);
    }
}
//# sourceMappingURL=tiles.codecs.vector.js.map

/***/ }),

/***/ "./dist/tiles/index.js":
/*!*****************************!*\
  !*** ./dist/tiles/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Attribution: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.Attribution),
/* harmony export */   KEY: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.KEY),
/* harmony export */   MapBoxTerrainDemV1UrlBuilder: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   MapBoxTileSetIds: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.MapBoxTileSetIds),
/* harmony export */   MapBoxVectorUrlBuilder: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.MapBoxVectorUrlBuilder),
/* harmony export */   MapboxAltitudeDecoder: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.MapboxAltitudeDecoder),
/* harmony export */   MaxLevelOfDetail: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.MaxLevelOfDetail),
/* harmony export */   TerrainDemV1Client: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.TerrainDemV1Client),
/* harmony export */   VectorClient: () => (/* reexport safe */ _vendors__WEBPACK_IMPORTED_MODULE_1__.VectorClient),
/* harmony export */   VectorTileCodec: () => (/* reexport safe */ _codecs__WEBPACK_IMPORTED_MODULE_0__.VectorTileCodec)
/* harmony export */ });
/* harmony import */ var _codecs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./codecs */ "./dist/tiles/codecs/index.js");
/* harmony import */ var _vendors__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./vendors */ "./dist/tiles/vendors/index.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/vendors/index.js":
/*!*************************************!*\
  !*** ./dist/tiles/vendors/index.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Attribution: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.Attribution),
/* harmony export */   KEY: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.KEY),
/* harmony export */   MapBoxTerrainDemV1UrlBuilder: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   MapBoxTileSetIds: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.MapBoxTileSetIds),
/* harmony export */   MapBoxVectorUrlBuilder: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.MapBoxVectorUrlBuilder),
/* harmony export */   MapboxAltitudeDecoder: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.MapboxAltitudeDecoder),
/* harmony export */   MaxLevelOfDetail: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.MaxLevelOfDetail),
/* harmony export */   TerrainDemV1Client: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.TerrainDemV1Client),
/* harmony export */   VectorClient: () => (/* reexport safe */ _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__.VectorClient)
/* harmony export */ });
/* harmony import */ var _tiles_vendors_mapbox__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles.vendors.mapbox */ "./dist/tiles/vendors/tiles.vendors.mapbox.js");

//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./dist/tiles/vendors/tiles.vendors.mapbox.js":
/*!****************************************************!*\
  !*** ./dist/tiles/vendors/tiles.vendors.mapbox.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Attribution: () => (/* binding */ Attribution),
/* harmony export */   KEY: () => (/* binding */ KEY),
/* harmony export */   MapBoxTerrainDemV1UrlBuilder: () => (/* binding */ MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   MapBoxTileSetIds: () => (/* binding */ MapBoxTileSetIds),
/* harmony export */   MapBoxVectorUrlBuilder: () => (/* binding */ MapBoxVectorUrlBuilder),
/* harmony export */   MapboxAltitudeDecoder: () => (/* binding */ MapboxAltitudeDecoder),
/* harmony export */   MaxLevelOfDetail: () => (/* binding */ MaxLevelOfDetail),
/* harmony export */   TerrainDemV1Client: () => (/* binding */ TerrainDemV1Client),
/* harmony export */   VectorClient: () => (/* binding */ VectorClient)
/* harmony export */ });
/* harmony import */ var core_dem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/tiles */ "core/tiles");
/* harmony import */ var core_dem__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_dem__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _codecs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../codecs */ "./dist/tiles/codecs/tiles.codecs.vector.js");




class MapBoxTerrainDemV1UrlBuilder extends core_dem__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
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
var MapBoxTileSetIds;
(function (MapBoxTileSetIds) {
    MapBoxTileSetIds["StreetsV8"] = "mapbox.mapbox-streets-v8";
    MapBoxTileSetIds["Terrain"] = "mapbox.mapbox-terrain-v2";
    MapBoxTileSetIds["Outdoors"] = "mapbox.mapbox-outdoors-v11";
    MapBoxTileSetIds["Traffic"] = "mapbox.mapbox-traffic-v1";
})(MapBoxTileSetIds || (MapBoxTileSetIds = {}));
class MapBoxVectorUrlBuilder extends core_dem__WEBPACK_IMPORTED_MODULE_0__.WebTileUrlBuilder {
    constructor(token, tileSetIds, extension = "mvt") {
        super();
        this.withHost("api.mapbox.com").withSecure(true).withQuery(`access_token=${token}`).withPath(`v4/${tileSetIds}/{z}/{x}/{y}.{extension}`).withExtension(extension);
    }
}
const MaxLevelOfDetail = 21;
const KEY = "mapbox";
const Attribution = "© Mapbox © OpenStreetMap";
const TerrainDemV1Client = function (token, options) {
    const metrics = new core_dem__WEBPACK_IMPORTED_MODULE_0__.EPSG3857({ maxLOD: MaxLevelOfDetail, tileSize: 512 });
    const codecOptions = new core_dem__WEBPACK_IMPORTED_MODULE_0__.Float32TileCodecOptionsBuilder().withInsets(1, core_dem__WEBPACK_IMPORTED_MODULE_0__.Side.top).withInsets(1, core_dem__WEBPACK_IMPORTED_MODULE_0__.Side.left).withInsets(1, core_dem__WEBPACK_IMPORTED_MODULE_0__.Side.bottom).withInsets(1, core_dem__WEBPACK_IMPORTED_MODULE_0__.Side.right).build();
    const elevationClient = new core_dem__WEBPACK_IMPORTED_MODULE_0__.TileWebClient(`${KEY}_elevation`, new MapBoxTerrainDemV1UrlBuilder(token), new core_dem__WEBPACK_IMPORTED_MODULE_0__.Float32TileCodec(MapboxAltitudeDecoder.Shared, codecOptions), metrics, options);
    return new core_dem__WEBPACK_IMPORTED_MODULE_0__.DemTileWebClient(`${KEY}_dem`, elevationClient);
};
const VectorClient = function (token, tileSetIds = MapBoxTileSetIds.Terrain, style, options) {
    const metrics = new core_dem__WEBPACK_IMPORTED_MODULE_0__.EPSG3857({ maxLOD: MaxLevelOfDetail, tileSize: 256 });
    return new core_dem__WEBPACK_IMPORTED_MODULE_0__.TileWebClient(`${token}`, new MapBoxVectorUrlBuilder(token, tileSetIds), new _codecs__WEBPACK_IMPORTED_MODULE_1__.VectorTileCodec(metrics, style), metrics, options);
};
//# sourceMappingURL=tiles.vendors.mapbox.js.map

/***/ }),

/***/ "core/tiles":
/*!**************************!*\
  !*** external "SPACEXR" ***!
  \**************************/
/***/ ((module) => {

module.exports = SPACEXR;

/***/ }),

/***/ "../../../../node_modules/@mapbox/point-geometry/index.js":
/*!****************************************************************!*\
  !*** ../../../../node_modules/@mapbox/point-geometry/index.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Point)
/* harmony export */ });
/**
 * A standalone point geometry with useful accessor, comparison, and
 * modification methods.
 *
 * @example
 * const point = new Point(-77, 38);
 */
class Point {
    /**
     * @param {number} x the x-coordinate. This could be longitude or screen pixels, or any other sort of unit.
     * @param {number} y the y-coordinate. This could be latitude or screen pixels, or any other sort of unit.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Clone this point, returning a new point that can be modified
     * without affecting the old one.
     * @return {Point} the clone
     */
    clone() { return new Point(this.x, this.y); }

    /**
     * Add this point's x & y coordinates to another point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    add(p) { return this.clone()._add(p); }

    /**
     * Subtract this point's x & y coordinates to from point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    sub(p) { return this.clone()._sub(p); }

    /**
     * Multiply this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    multByPoint(p) { return this.clone()._multByPoint(p); }

    /**
     * Divide this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    divByPoint(p) { return this.clone()._divByPoint(p); }

    /**
     * Multiply this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
    mult(k) { return this.clone()._mult(k); }

    /**
     * Divide this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
    div(k) { return this.clone()._div(k); }

    /**
     * Rotate this point around the 0, 0 origin by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @return {Point} output point
     */
    rotate(a) { return this.clone()._rotate(a); }

    /**
     * Rotate this point around p point by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @param {Point} p Point to rotate around
     * @return {Point} output point
     */
    rotateAround(a, p) { return this.clone()._rotateAround(a, p); }

    /**
     * Multiply this point by a 4x1 transformation matrix
     * @param {[number, number, number, number]} m transformation matrix
     * @return {Point} output point
     */
    matMult(m) { return this.clone()._matMult(m); }

    /**
     * Calculate this point but as a unit vector from 0, 0, meaning
     * that the distance from the resulting point to the 0, 0
     * coordinate will be equal to 1 and the angle from the resulting
     * point to the 0, 0 coordinate will be the same as before.
     * @return {Point} unit vector point
     */
    unit() { return this.clone()._unit(); }

    /**
     * Compute a perpendicular point, where the new y coordinate
     * is the old x coordinate and the new x coordinate is the old y
     * coordinate multiplied by -1
     * @return {Point} perpendicular point
     */
    perp() { return this.clone()._perp(); }

    /**
     * Return a version of this point with the x & y coordinates
     * rounded to integers.
     * @return {Point} rounded point
     */
    round() { return this.clone()._round(); }

    /**
     * Return the magnitude of this point: this is the Euclidean
     * distance from the 0, 0 coordinate to this point's x and y
     * coordinates.
     * @return {number} magnitude
     */
    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Judge whether this point is equal to another point, returning
     * true or false.
     * @param {Point} other the other point
     * @return {boolean} whether the points are equal
     */
    equals(other) {
        return this.x === other.x &&
               this.y === other.y;
    }

    /**
     * Calculate the distance from this point to another point
     * @param {Point} p the other point
     * @return {number} distance
     */
    dist(p) {
        return Math.sqrt(this.distSqr(p));
    }

    /**
     * Calculate the distance from this point to another point,
     * without the square root step. Useful if you're comparing
     * relative distances.
     * @param {Point} p the other point
     * @return {number} distance
     */
    distSqr(p) {
        const dx = p.x - this.x,
            dy = p.y - this.y;
        return dx * dx + dy * dy;
    }

    /**
     * Get the angle from the 0, 0 coordinate to this point, in radians
     * coordinates.
     * @return {number} angle
     */
    angle() {
        return Math.atan2(this.y, this.x);
    }

    /**
     * Get the angle from this point to another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
    angleTo(b) {
        return Math.atan2(this.y - b.y, this.x - b.x);
    }

    /**
     * Get the angle between this point and another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
    angleWith(b) {
        return this.angleWithSep(b.x, b.y);
    }

    /**
     * Find the angle of the two vectors, solving the formula for
     * the cross product a x b = |a||b|sin(θ) for θ.
     * @param {number} x the x-coordinate
     * @param {number} y the y-coordinate
     * @return {number} the angle in radians
     */
    angleWithSep(x, y) {
        return Math.atan2(
            this.x * y - this.y * x,
            this.x * x + this.y * y);
    }

    /** @param {[number, number, number, number]} m */
    _matMult(m) {
        const x = m[0] * this.x + m[1] * this.y,
            y = m[2] * this.x + m[3] * this.y;
        this.x = x;
        this.y = y;
        return this;
    }

    /** @param {Point} p */
    _add(p) {
        this.x += p.x;
        this.y += p.y;
        return this;
    }

    /** @param {Point} p */
    _sub(p) {
        this.x -= p.x;
        this.y -= p.y;
        return this;
    }

    /** @param {number} k */
    _mult(k) {
        this.x *= k;
        this.y *= k;
        return this;
    }

    /** @param {number} k */
    _div(k) {
        this.x /= k;
        this.y /= k;
        return this;
    }

    /** @param {Point} p */
    _multByPoint(p) {
        this.x *= p.x;
        this.y *= p.y;
        return this;
    }

    /** @param {Point} p */
    _divByPoint(p) {
        this.x /= p.x;
        this.y /= p.y;
        return this;
    }

    _unit() {
        this._div(this.mag());
        return this;
    }

    _perp() {
        const y = this.y;
        this.y = this.x;
        this.x = -y;
        return this;
    }

    /** @param {number} angle */
    _rotate(angle) {
        const cos = Math.cos(angle),
            sin = Math.sin(angle),
            x = cos * this.x - sin * this.y,
            y = sin * this.x + cos * this.y;
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * @param {number} angle
     * @param {Point} p
     */
    _rotateAround(angle, p) {
        const cos = Math.cos(angle),
            sin = Math.sin(angle),
            x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y),
            y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
        this.x = x;
        this.y = y;
        return this;
    }

    _round() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }

    /**
     * Construct a point from an array if necessary, otherwise if the input
     * is already a Point, or an unknown type, return it unchanged
     * @param {[number, number] | Point} a any kind of input value
     * @return {Point} constructed point, or passed-through value.
     * @example
     * // this
     * var point = Point.convert([0, 1]);
     * // is equivalent to
     * var point = new Point(0, 1);
     */
    static convert(a) {
        if (a instanceof Point) {
            return a;
        }
        if (Array.isArray(a)) {
            return new Point(a[0], a[1]);
        }
        return a;
    }
}


/***/ }),

/***/ "../../../../node_modules/@mapbox/vector-tile/index.js":
/*!*************************************************************!*\
  !*** ../../../../node_modules/@mapbox/vector-tile/index.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VectorTile: () => (/* binding */ VectorTile),
/* harmony export */   VectorTileFeature: () => (/* binding */ VectorTileFeature),
/* harmony export */   VectorTileLayer: () => (/* binding */ VectorTileLayer),
/* harmony export */   classifyRings: () => (/* binding */ classifyRings)
/* harmony export */ });
/* harmony import */ var _mapbox_point_geometry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @mapbox/point-geometry */ "../../../../node_modules/@mapbox/point-geometry/index.js");



/** @import Pbf from 'pbf' */
/** @import {Feature} from 'geojson' */

class VectorTileFeature {
    /**
     * @param {Pbf} pbf
     * @param {number} end
     * @param {number} extent
     * @param {string[]} keys
     * @param {unknown[]} values
     */
    constructor(pbf, end, extent, keys, values) {
        // Public

        /** @type {Record<string, unknown>} */
        this.properties = {};

        this.extent = extent;
        /** @type {0 | 1 | 2 | 3} */
        this.type = 0;

        /** @type {number | undefined} */
        this.id = undefined;

        this._pbf = pbf;
        this._geometry = -1;
        this._keys = keys;
        this._values = values;

        pbf.readFields(readFeature, this, end);
    }

    loadGeometry() {
        const pbf = this._pbf;
        pbf.pos = this._geometry;

        const end = pbf.readVarint() + pbf.pos;

        /** @type Point[][] */
        const lines = [];

        /** @type Point[] | undefined */
        let line;

        let cmd = 1;
        let length = 0;
        let x = 0;
        let y = 0;

        while (pbf.pos < end) {
            if (length <= 0) {
                const cmdLen = pbf.readVarint();
                cmd = cmdLen & 0x7;
                length = cmdLen >> 3;
            }

            length--;

            if (cmd === 1 || cmd === 2) {
                x += pbf.readSVarint();
                y += pbf.readSVarint();

                if (cmd === 1) { // moveTo
                    if (line) lines.push(line);
                    line = [];
                }

                if (line) line.push(new _mapbox_point_geometry__WEBPACK_IMPORTED_MODULE_0__["default"](x, y));

            } else if (cmd === 7) {

                // Workaround for https://github.com/mapbox/mapnik-vector-tile/issues/90
                if (line) {
                    line.push(line[0].clone()); // closePolygon
                }

            } else {
                throw new Error(`unknown command ${cmd}`);
            }
        }

        if (line) lines.push(line);

        return lines;
    }

    bbox() {
        const pbf = this._pbf;
        pbf.pos = this._geometry;

        const end = pbf.readVarint() + pbf.pos;
        let cmd = 1,
            length = 0,
            x = 0,
            y = 0,
            x1 = Infinity,
            x2 = -Infinity,
            y1 = Infinity,
            y2 = -Infinity;

        while (pbf.pos < end) {
            if (length <= 0) {
                const cmdLen = pbf.readVarint();
                cmd = cmdLen & 0x7;
                length = cmdLen >> 3;
            }

            length--;

            if (cmd === 1 || cmd === 2) {
                x += pbf.readSVarint();
                y += pbf.readSVarint();
                if (x < x1) x1 = x;
                if (x > x2) x2 = x;
                if (y < y1) y1 = y;
                if (y > y2) y2 = y;

            } else if (cmd !== 7) {
                throw new Error(`unknown command ${cmd}`);
            }
        }

        return [x1, y1, x2, y2];
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @return {Feature}
     */
    toGeoJSON(x, y, z) {
        const size = this.extent * Math.pow(2, z),
            x0 = this.extent * x,
            y0 = this.extent * y,
            vtCoords = this.loadGeometry();

        /** @param {Point} p */
        function projectPoint(p) {
            return [
                (p.x + x0) * 360 / size - 180,
                360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
            ];
        }

        /** @param {Point[]} line */
        function projectLine(line) {
            return line.map(projectPoint);
        }

        /** @type {Feature["geometry"]} */
        let geometry;

        if (this.type === 1) {
            const points = [];
            for (const line of vtCoords) {
                points.push(line[0]);
            }
            const coordinates = projectLine(points);
            geometry = points.length === 1 ?
                {type: 'Point', coordinates: coordinates[0]} :
                {type: 'MultiPoint', coordinates};

        } else if (this.type === 2) {

            const coordinates = vtCoords.map(projectLine);
            geometry = coordinates.length === 1 ?
                {type: 'LineString', coordinates: coordinates[0]} :
                {type: 'MultiLineString', coordinates};

        } else if (this.type === 3) {
            const polygons = classifyRings(vtCoords);
            const coordinates = [];
            for (const polygon of polygons) {
                coordinates.push(polygon.map(projectLine));
            }
            geometry = coordinates.length === 1 ?
                {type: 'Polygon', coordinates: coordinates[0]} :
                {type: 'MultiPolygon', coordinates};
        } else {

            throw new Error('unknown feature type');
        }

        /** @type {Feature} */
        const result = {
            type: 'Feature',
            geometry,
            properties: this.properties
        };

        if (this.id != null) {
            result.id = this.id;
        }

        return result;
    }
}

/** @type {['Unknown', 'Point', 'LineString', 'Polygon']} */
VectorTileFeature.types = ['Unknown', 'Point', 'LineString', 'Polygon'];

/**
 * @param {number} tag
 * @param {VectorTileFeature} feature
 * @param {Pbf} pbf
 */
function readFeature(tag, feature, pbf) {
    if (tag === 1) feature.id = pbf.readVarint();
    else if (tag === 2) readTag(pbf, feature);
    else if (tag === 3) feature.type = /** @type {0 | 1 | 2 | 3} */ (pbf.readVarint());
    else if (tag === 4) feature._geometry = pbf.pos;
}

/**
 * @param {Pbf} pbf
 * @param {VectorTileFeature} feature
 */
function readTag(pbf, feature) {
    const end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
        const key = feature._keys[pbf.readVarint()],
            value = feature._values[pbf.readVarint()];
        feature.properties[key] = value;
    }
}

/** classifies an array of rings into polygons with outer rings and holes
 * @param {Point[][]} rings
 */
function classifyRings(rings) {
    const len = rings.length;

    if (len <= 1) return [rings];

    const polygons = [];
    let polygon, ccw;

    for (let i = 0; i < len; i++) {
        const area = signedArea(rings[i]);
        if (area === 0) continue;

        if (ccw === undefined) ccw = area < 0;

        if (ccw === area < 0) {
            if (polygon) polygons.push(polygon);
            polygon = [rings[i]];

        } else if (polygon) {
            polygon.push(rings[i]);
        }
    }
    if (polygon) polygons.push(polygon);

    return polygons;
}

/** @param {Point[]} ring */
function signedArea(ring) {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}

class VectorTileLayer {
    /**
     * @param {Pbf} pbf
     * @param {number} [end]
     */
    constructor(pbf, end) {
        // Public
        this.version = 1;
        this.name = '';
        this.extent = 4096;
        this.length = 0;

        // Private
        this._pbf = pbf;

        /** @type {string[]} */
        this._keys = [];

        /** @type {unknown[]} */
        this._values = [];

        /** @type {number[]} */
        this._features = [];

        pbf.readFields(readLayer, this, end);

        this.length = this._features.length;
    }

    /** return feature `i` from this layer as a `VectorTileFeature`
     * @param {number} i
     */
    feature(i) {
        if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');

        this._pbf.pos = this._features[i];

        const end = this._pbf.readVarint() + this._pbf.pos;
        return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
    }
}

/**
 * @param {number} tag
 * @param {VectorTileLayer} layer
 * @param {Pbf} pbf
 */
function readLayer(tag, layer, pbf) {
    if (tag === 15) layer.version = pbf.readVarint();
    else if (tag === 1) layer.name = pbf.readString();
    else if (tag === 5) layer.extent = pbf.readVarint();
    else if (tag === 2) layer._features.push(pbf.pos);
    else if (tag === 3) layer._keys.push(pbf.readString());
    else if (tag === 4) layer._values.push(readValueMessage(pbf));
}

/**
 * @param {Pbf} pbf
 */
function readValueMessage(pbf) {
    let value = null;
    const end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
        const tag = pbf.readVarint() >> 3;

        value = tag === 1 ? pbf.readString() :
            tag === 2 ? pbf.readFloat() :
            tag === 3 ? pbf.readDouble() :
            tag === 4 ? pbf.readVarint64() :
            tag === 5 ? pbf.readVarint() :
            tag === 6 ? pbf.readSVarint() :
            tag === 7 ? pbf.readBoolean() : null;
    }

    return value;
}

class VectorTile {
    /**
     * @param {Pbf} pbf
     * @param {number} [end]
     */
    constructor(pbf, end) {
        /** @type {Record<string, VectorTileLayer>} */
        this.layers = pbf.readFields(readTile, {}, end);
    }
}

/**
 * @param {number} tag
 * @param {Record<string, VectorTileLayer>} layers
 * @param {Pbf} pbf
 */
function readTile(tag, layers, pbf) {
    if (tag === 3) {
        const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
        if (layer.length) layers[layer.name] = layer;
    }
}


/***/ }),

/***/ "../../../../node_modules/pbf/index.js":
/*!*********************************************!*\
  !*** ../../../../node_modules/pbf/index.js ***!
  \*********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Pbf)
/* harmony export */ });

const SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
const SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;

// Threshold chosen based on both benchmarking and knowledge about browser string
// data structures (which currently switch structure types at 12 bytes or more)
const TEXT_DECODER_MIN_LENGTH = 12;
const utf8TextDecoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder('utf-8');

const PBF_VARINT  = 0; // varint: int32, int64, uint32, uint64, sint32, sint64, bool, enum
const PBF_FIXED64 = 1; // 64-bit: double, fixed64, sfixed64
const PBF_BYTES   = 2; // length-delimited: string, bytes, embedded messages, packed repeated fields
const PBF_FIXED32 = 5; // 32-bit: float, fixed32, sfixed32

class Pbf {
    /**
     * @param {Uint8Array | ArrayBuffer} [buf]
     */
    constructor(buf = new Uint8Array(16)) {
        this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
        this.dataView = new DataView(this.buf.buffer);
        this.pos = 0;
        this.type = 0;
        this.length = this.buf.length;
    }

    // === READING =================================================================

    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     * @param {number} [end]
     */
    readFields(readField, result, end = this.length) {
        while (this.pos < end) {
            const val = this.readVarint(),
                tag = val >> 3,
                startPos = this.pos;

            this.type = val & 0x7;
            readField(tag, result, this);

            if (this.pos === startPos) this.skip(val);
        }
        return result;
    }

    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     */
    readMessage(readField, result) {
        return this.readFields(readField, result, this.readVarint() + this.pos);
    }

    readFixed32() {
        const val = this.dataView.getUint32(this.pos, true);
        this.pos += 4;
        return val;
    }

    readSFixed32() {
        const val = this.dataView.getInt32(this.pos, true);
        this.pos += 4;
        return val;
    }

    // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)

    readFixed64() {
        const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
        this.pos += 8;
        return val;
    }

    readSFixed64() {
        const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
        this.pos += 8;
        return val;
    }

    readFloat() {
        const val = this.dataView.getFloat32(this.pos, true);
        this.pos += 4;
        return val;
    }

    readDouble() {
        const val = this.dataView.getFloat64(this.pos, true);
        this.pos += 8;
        return val;
    }

    /**
     * @param {boolean} [isSigned]
     */
    readVarint(isSigned) {
        const buf = this.buf;
        let val, b;

        b = buf[this.pos++]; val  =  b & 0x7f;        if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 7;  if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 14; if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 21; if (b < 0x80) return val;
        b = buf[this.pos];   val |= (b & 0x0f) << 28;

        return readVarintRemainder(val, isSigned, this);
    }

    readVarint64() { // for compatibility with v2.0.1
        return this.readVarint(true);
    }

    readSVarint() {
        const num = this.readVarint();
        return num % 2 === 1 ? (num + 1) / -2 : num / 2; // zigzag encoding
    }

    readBoolean() {
        return Boolean(this.readVarint());
    }

    readString() {
        const end = this.readVarint() + this.pos;
        const pos = this.pos;
        this.pos = end;

        if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
            // longer strings are fast with the built-in browser TextDecoder API
            return utf8TextDecoder.decode(this.buf.subarray(pos, end));
        }
        // short strings are fast with our custom implementation
        return readUtf8(this.buf, pos, end);
    }

    readBytes() {
        const end = this.readVarint() + this.pos,
            buffer = this.buf.subarray(this.pos, end);
        this.pos = end;
        return buffer;
    }

    // verbose for performance reasons; doesn't affect gzipped size

    /**
     * @param {number[]} [arr]
     * @param {boolean} [isSigned]
     */
    readPackedVarint(arr = [], isSigned) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readVarint(isSigned));
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSVarint(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readSVarint());
        return arr;
    }
    /** @param {boolean[]} [arr] */
    readPackedBoolean(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readBoolean());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFloat(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readFloat());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedDouble(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readDouble());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed32(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readFixed32());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed32(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readSFixed32());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed64(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readFixed64());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed64(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readSFixed64());
        return arr;
    }
    readPackedEnd() {
        return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
    }

    /** @param {number} val */
    skip(val) {
        const type = val & 0x7;
        if (type === PBF_VARINT) while (this.buf[this.pos++] > 0x7f) {}
        else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
        else if (type === PBF_FIXED32) this.pos += 4;
        else if (type === PBF_FIXED64) this.pos += 8;
        else throw new Error(`Unimplemented type: ${type}`);
    }

    // === WRITING =================================================================

    /**
     * @param {number} tag
     * @param {number} type
     */
    writeTag(tag, type) {
        this.writeVarint((tag << 3) | type);
    }

    /** @param {number} min */
    realloc(min) {
        let length = this.length || 16;

        while (length < this.pos + min) length *= 2;

        if (length !== this.length) {
            const buf = new Uint8Array(length);
            buf.set(this.buf);
            this.buf = buf;
            this.dataView = new DataView(buf.buffer);
            this.length = length;
        }
    }

    finish() {
        this.length = this.pos;
        this.pos = 0;
        return this.buf.subarray(0, this.length);
    }

    /** @param {number} val */
    writeFixed32(val) {
        this.realloc(4);
        this.dataView.setInt32(this.pos, val, true);
        this.pos += 4;
    }

    /** @param {number} val */
    writeSFixed32(val) {
        this.realloc(4);
        this.dataView.setInt32(this.pos, val, true);
        this.pos += 4;
    }

    /** @param {number} val */
    writeFixed64(val) {
        this.realloc(8);
        this.dataView.setInt32(this.pos, val & -1, true);
        this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
        this.pos += 8;
    }

    /** @param {number} val */
    writeSFixed64(val) {
        this.realloc(8);
        this.dataView.setInt32(this.pos, val & -1, true);
        this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
        this.pos += 8;
    }

    /** @param {number} val */
    writeVarint(val) {
        val = +val || 0;

        if (val > 0xfffffff || val < 0) {
            writeBigVarint(val, this);
            return;
        }

        this.realloc(4);

        this.buf[this.pos++] =           val & 0x7f  | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] =   (val >>> 7) & 0x7f;
    }

    /** @param {number} val */
    writeSVarint(val) {
        this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
    }

    /** @param {boolean} val */
    writeBoolean(val) {
        this.writeVarint(+val);
    }

    /** @param {string} str */
    writeString(str) {
        str = String(str);
        this.realloc(str.length * 4);

        this.pos++; // reserve 1 byte for short string length

        const startPos = this.pos;
        // write the string directly to the buffer and see how much was written
        this.pos = writeUtf8(this.buf, str, this.pos);
        const len = this.pos - startPos;

        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

        // finally, write the message length in the reserved place and restore the position
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
    }

    /** @param {number} val */
    writeFloat(val) {
        this.realloc(4);
        this.dataView.setFloat32(this.pos, val, true);
        this.pos += 4;
    }

    /** @param {number} val */
    writeDouble(val) {
        this.realloc(8);
        this.dataView.setFloat64(this.pos, val, true);
        this.pos += 8;
    }

    /** @param {Uint8Array} buffer */
    writeBytes(buffer) {
        const len = buffer.length;
        this.writeVarint(len);
        this.realloc(len);
        for (let i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
    }

    /**
     * @template T
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeRawMessage(fn, obj) {
        this.pos++; // reserve 1 byte for short message length

        // write the message directly to the buffer and see how much was written
        const startPos = this.pos;
        fn(obj, this);
        const len = this.pos - startPos;

        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

        // finally, write the message length in the reserved place and restore the position
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
    }

    /**
     * @template T
     * @param {number} tag
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeMessage(tag, fn, obj) {
        this.writeTag(tag, PBF_BYTES);
        this.writeRawMessage(fn, obj);
    }

    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedVarint(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSVarint(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {boolean[]} arr
     */
    writePackedBoolean(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFloat(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFloat, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedDouble(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedDouble, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed32(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed32(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed64(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed64(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr);
    }

    /**
     * @param {number} tag
     * @param {Uint8Array} buffer
     */
    writeBytesField(tag, buffer) {
        this.writeTag(tag, PBF_BYTES);
        this.writeBytes(buffer);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed32Field(tag, val) {
        this.writeTag(tag, PBF_FIXED32);
        this.writeFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed32Field(tag, val) {
        this.writeTag(tag, PBF_FIXED32);
        this.writeSFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed64Field(tag, val) {
        this.writeTag(tag, PBF_FIXED64);
        this.writeFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed64Field(tag, val) {
        this.writeTag(tag, PBF_FIXED64);
        this.writeSFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeVarintField(tag, val) {
        this.writeTag(tag, PBF_VARINT);
        this.writeVarint(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSVarintField(tag, val) {
        this.writeTag(tag, PBF_VARINT);
        this.writeSVarint(val);
    }
    /**
     * @param {number} tag
     * @param {string} str
     */
    writeStringField(tag, str) {
        this.writeTag(tag, PBF_BYTES);
        this.writeString(str);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFloatField(tag, val) {
        this.writeTag(tag, PBF_FIXED32);
        this.writeFloat(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeDoubleField(tag, val) {
        this.writeTag(tag, PBF_FIXED64);
        this.writeDouble(val);
    }
    /**
     * @param {number} tag
     * @param {boolean} val
     */
    writeBooleanField(tag, val) {
        this.writeVarintField(tag, +val);
    }
};

/**
 * @param {number} l
 * @param {boolean | undefined} s
 * @param {Pbf} p
 */
function readVarintRemainder(l, s, p) {
    const buf = p.buf;
    let h, b;

    b = buf[p.pos++]; h  = (b & 0x70) >> 4;  if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 3;  if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 10; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 17; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 24; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x01) << 31; if (b < 0x80) return toNum(l, h, s);

    throw new Error('Expected varint not more than 10 bytes');
}

/**
 * @param {number} low
 * @param {number} high
 * @param {boolean} [isSigned]
 */
function toNum(low, high, isSigned) {
    return isSigned ? high * 0x100000000 + (low >>> 0) : ((high >>> 0) * 0x100000000) + (low >>> 0);
}

/**
 * @param {number} val
 * @param {Pbf} pbf
 */
function writeBigVarint(val, pbf) {
    let low, high;

    if (val >= 0) {
        low  = (val % 0x100000000) | 0;
        high = (val / 0x100000000) | 0;
    } else {
        low  = ~(-val % 0x100000000);
        high = ~(-val / 0x100000000);

        if (low ^ 0xffffffff) {
            low = (low + 1) | 0;
        } else {
            low = 0;
            high = (high + 1) | 0;
        }
    }

    if (val >= 0x10000000000000000 || val < -0x10000000000000000) {
        throw new Error('Given varint doesn\'t fit into 10 bytes');
    }

    pbf.realloc(10);

    writeBigVarintLow(low, high, pbf);
    writeBigVarintHigh(high, pbf);
}

/**
 * @param {number} high
 * @param {number} low
 * @param {Pbf} pbf
 */
function writeBigVarintLow(low, high, pbf) {
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos]   = low & 0x7f;
}

/**
 * @param {number} high
 * @param {Pbf} pbf
 */
function writeBigVarintHigh(high, pbf) {
    const lsb = (high & 0x07) << 4;

    pbf.buf[pbf.pos++] |= lsb         | ((high >>>= 3) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f;
}

/**
 * @param {number} startPos
 * @param {number} len
 * @param {Pbf} pbf
 */
function makeRoomForExtraLength(startPos, len, pbf) {
    const extraLen =
        len <= 0x3fff ? 1 :
        len <= 0x1fffff ? 2 :
        len <= 0xfffffff ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));

    // if 1 byte isn't enough for encoding message length, shift the data to the right
    pbf.realloc(extraLen);
    for (let i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
}

/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedSVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedFloat(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedDouble(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
}
/**
 * @param {boolean[]} arr
 * @param {Pbf} pbf
 */
function writePackedBoolean(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedSFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedSFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
}

// Buffer code below from https://github.com/feross/buffer, MIT-licensed

/**
 * @param {Uint8Array} buf
 * @param {number} pos
 * @param {number} end
 */
function readUtf8(buf, pos, end) {
    let str = '';
    let i = pos;

    while (i < end) {
        const b0 = buf[i];
        let c = null; // codepoint
        let bytesPerSequence =
            b0 > 0xEF ? 4 :
            b0 > 0xDF ? 3 :
            b0 > 0xBF ? 2 : 1;

        if (i + bytesPerSequence > end) break;

        let b1, b2, b3;

        if (bytesPerSequence === 1) {
            if (b0 < 0x80) {
                c = b0;
            }
        } else if (bytesPerSequence === 2) {
            b1 = buf[i + 1];
            if ((b1 & 0xC0) === 0x80) {
                c = (b0 & 0x1F) << 0x6 | (b1 & 0x3F);
                if (c <= 0x7F) {
                    c = null;
                }
            }
        } else if (bytesPerSequence === 3) {
            b1 = buf[i + 1];
            b2 = buf[i + 2];
            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80) {
                c = (b0 & 0xF) << 0xC | (b1 & 0x3F) << 0x6 | (b2 & 0x3F);
                if (c <= 0x7FF || (c >= 0xD800 && c <= 0xDFFF)) {
                    c = null;
                }
            }
        } else if (bytesPerSequence === 4) {
            b1 = buf[i + 1];
            b2 = buf[i + 2];
            b3 = buf[i + 3];
            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
                c = (b0 & 0xF) << 0x12 | (b1 & 0x3F) << 0xC | (b2 & 0x3F) << 0x6 | (b3 & 0x3F);
                if (c <= 0xFFFF || c >= 0x110000) {
                    c = null;
                }
            }
        }

        if (c === null) {
            c = 0xFFFD;
            bytesPerSequence = 1;

        } else if (c > 0xFFFF) {
            c -= 0x10000;
            str += String.fromCharCode(c >>> 10 & 0x3FF | 0xD800);
            c = 0xDC00 | c & 0x3FF;
        }

        str += String.fromCharCode(c);
        i += bytesPerSequence;
    }

    return str;
}

/**
 * @param {Uint8Array} buf
 * @param {string} str
 * @param {number} pos
 */
function writeUtf8(buf, str, pos) {
    for (let i = 0, c, lead; i < str.length; i++) {
        c = str.charCodeAt(i); // code point

        if (c > 0xD7FF && c < 0xE000) {
            if (lead) {
                if (c < 0xDC00) {
                    buf[pos++] = 0xEF;
                    buf[pos++] = 0xBF;
                    buf[pos++] = 0xBD;
                    lead = c;
                    continue;
                } else {
                    c = lead - 0xD800 << 10 | c - 0xDC00 | 0x10000;
                    lead = null;
                }
            } else {
                if (c > 0xDBFF || (i + 1 === str.length)) {
                    buf[pos++] = 0xEF;
                    buf[pos++] = 0xBF;
                    buf[pos++] = 0xBD;
                } else {
                    lead = c;
                }
                continue;
            }
        } else if (lead) {
            buf[pos++] = 0xEF;
            buf[pos++] = 0xBF;
            buf[pos++] = 0xBD;
            lead = null;
        }

        if (c < 0x80) {
            buf[pos++] = c;
        } else {
            if (c < 0x800) {
                buf[pos++] = c >> 0x6 | 0xC0;
            } else {
                if (c < 0x10000) {
                    buf[pos++] = c >> 0xC | 0xE0;
                } else {
                    buf[pos++] = c >> 0x12 | 0xF0;
                    buf[pos++] = c >> 0xC & 0x3F | 0x80;
                }
                buf[pos++] = c >> 0x6 & 0x3F | 0x80;
            }
            buf[pos++] = c & 0x3F | 0x80;
        }
    }
    return pos;
}


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
/* harmony export */   Attribution: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.Attribution),
/* harmony export */   KEY: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.KEY),
/* harmony export */   MapBoxTerrainDemV1UrlBuilder: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.MapBoxTerrainDemV1UrlBuilder),
/* harmony export */   MapBoxTileSetIds: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.MapBoxTileSetIds),
/* harmony export */   MapBoxVectorUrlBuilder: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.MapBoxVectorUrlBuilder),
/* harmony export */   MapboxAltitudeDecoder: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.MapboxAltitudeDecoder),
/* harmony export */   MaxLevelOfDetail: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.MaxLevelOfDetail),
/* harmony export */   TerrainDemV1Client: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.TerrainDemV1Client),
/* harmony export */   VectorClient: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.VectorClient),
/* harmony export */   VectorTileCodec: () => (/* reexport safe */ _tiles__WEBPACK_IMPORTED_MODULE_0__.VectorTileCodec)
/* harmony export */ });
/* harmony import */ var _tiles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiles */ "./dist/tiles/index.js");

//# sourceMappingURL=index.js.map
})();

SPACEXR_MAPBOX = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=spacexr_vector.1.0.0.js.map