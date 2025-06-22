var SPACEXR_OSM;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dist/osm.colorResolver.js":
/*!***********************************!*\
  !*** ./dist/osm.colorResolver.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ColorResolver: () => (/* binding */ ColorResolver)
/* harmony export */ });
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math */ "core/math");
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math__WEBPACK_IMPORTED_MODULE_0__);

class ColorResolver {
    constructor(defaultColor, colorMap) {
        this.defaultColor = defaultColor;
        this.colorMap = colorMap;
    }
    getColor(key) {
        let v = this.colorMap.get(key);
        if (v) {
            switch (v[0]) {
                case "#":
                    return core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.Parse(v);
                case "@":
                    return this.getColor(v.substring(1));
                default:
                    return new core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor(core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.CSSMap.get(v) ?? this.defaultColor);
            }
        }
        return new core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor(this.defaultColor);
    }
}
//# sourceMappingURL=osm.colorResolver.js.map

/***/ }),

/***/ "./dist/osm.interfaces.building.js":
/*!*****************************************!*\
  !*** ./dist/osm.interfaces.building.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BuildingMaterialOptions: () => (/* binding */ BuildingMaterialOptions),
/* harmony export */   BuildingOptions: () => (/* binding */ BuildingOptions),
/* harmony export */   RoofOptions: () => (/* binding */ RoofOptions),
/* harmony export */   RoofOrientation: () => (/* binding */ RoofOrientation),
/* harmony export */   RoofShape: () => (/* binding */ RoofShape)
/* harmony export */ });
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math */ "core/math");
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _osm_interfaces__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./osm.interfaces */ "./dist/osm.interfaces.js");
/* harmony import */ var _osm_tagset__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./osm.tagset */ "./dist/osm.tagset.js");



var RoofShape;
(function (RoofShape) {
    RoofShape[RoofShape["flat"] = 0] = "flat";
    RoofShape[RoofShape["skillion"] = 1] = "skillion";
    RoofShape[RoofShape["gabled"] = 2] = "gabled";
    RoofShape[RoofShape["halfHipped"] = 3] = "halfHipped";
    RoofShape[RoofShape["hipped"] = 4] = "hipped";
    RoofShape[RoofShape["pyramidal"] = 5] = "pyramidal";
    RoofShape[RoofShape["gambrel"] = 6] = "gambrel";
    RoofShape[RoofShape["mansard"] = 7] = "mansard";
    RoofShape[RoofShape["dome"] = 8] = "dome";
    RoofShape[RoofShape["onion"] = 9] = "onion";
    RoofShape[RoofShape["round"] = 10] = "round";
    RoofShape[RoofShape["saltbox"] = 11] = "saltbox";
})(RoofShape || (RoofShape = {}));
var RoofOrientation;
(function (RoofOrientation) {
    RoofOrientation[RoofOrientation["along"] = 0] = "along";
    RoofOrientation[RoofOrientation["across"] = 1] = "across";
})(RoofOrientation || (RoofOrientation = {}));
class BuildingMaterialOptions {
    constructor() {
        this.color = null;
        this.material = null;
    }
}
class RoofOptions {
    constructor() {
        this.shape = RoofShape.flat;
        this.orientation = 0;
        this.height = 0;
        this.angle = 0;
        this.levels = 0;
        this.direction = 0;
        this.material = null;
    }
    static IsRoof(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_2__.OSMTagSet(record);
        return tags.readValue("roof:shape") !== undefined;
    }
    static FromTags(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_2__.OSMTagSet(record);
        if (!this.IsRoof(tags)) {
            return undefined;
        }
        const o = new RoofOptions();
        const shapeVal = tags.readValue("roof:shape");
        if (shapeVal && RoofShape.hasOwnProperty(shapeVal)) {
            o.shape = RoofShape[shapeVal];
        }
        const orientation = tags.readValue("roof:orientation");
        if (orientation === "across") {
            o.orientation = RoofOrientation.across;
        }
        o.height = tags.readFloat("roof:height", 0);
        o.angle = tags.readFloat("roof:angle", 0);
        o.levels = tags.readInt("roof:levels", 0);
        const dir = tags.readValue("roof:direction");
        if (dir) {
            o.direction = this.CardinalDirections.get(dir) ?? parseFloat(dir);
        }
        const color = tags.readValue("roof:colour");
        const mat = tags.readValue("roof:material");
        if (color || mat) {
            o.material = {
                color: color ? core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.Parse(color) : null,
                material: mat ?? null,
            };
        }
        return o;
    }
}
RoofOptions.CardinalDirections = new Map([
    ["N", 0],
    ["NNE", 22],
    ["NE", 45],
    ["ENE", 67],
    ["E", 90],
    ["ESE", 112],
    ["SE", 135],
    ["SSE", 157],
    ["S", 180],
    ["SSW", 202],
    ["SW", 225],
    ["WSW", 247],
    ["W", 270],
    ["WNW", 292],
    ["NW", 315],
    ["NNW", 337],
]);
RoofOptions.Shapes = new Map([
    ["flat", RoofShape.flat],
    ["skillion", RoofShape.skillion],
    ["gabled", RoofShape.gabled],
    ["halfHipped", RoofShape.halfHipped],
    ["hipped", RoofShape.hipped],
    ["pyramidal", RoofShape.pyramidal],
    ["gambrel", RoofShape.gambrel],
    ["mansard", RoofShape.mansard],
    ["dome", RoofShape.dome],
    ["onion", RoofShape.onion],
    ["round", RoofShape.round],
    ["saltbox", RoofShape.saltbox],
]);
class BuildingOptions {
    constructor() {
        this.height = 0;
        this.min_height = 0;
        this.levels = 0;
        this.min_levels = 0;
        this.material = null;
        this.roof = null;
    }
    static IsBuilding(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_2__.OSMTagSet(record);
        return tags.readValue("building") !== undefined || tags.readValue("building:part") !== undefined;
    }
    static FromTags(record) {
        var tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_1__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_2__.OSMTagSet(record);
        if (!this.IsBuilding(tags)) {
            return undefined;
        }
        var o = new BuildingOptions();
        let str;
        o.height = tags.readInt("height", 0);
        o.min_height = tags.readInt("min_height", 0);
        o.levels = tags.readInt("building:levels", 0);
        o.min_levels = tags.readInt("building:min_level", 0);
        o.roof = RoofOptions.FromTags(tags) ?? null;
        var om = new BuildingMaterialOptions();
        str = tags.readValue("building:colour");
        if (str) {
            om.color = core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.Parse(str);
        }
        om.material = tags.readValue("building:material") ?? null;
        o.material = om.color || om.material ? om : null;
        return o;
    }
}
//# sourceMappingURL=osm.interfaces.building.js.map

/***/ }),

/***/ "./dist/osm.interfaces.forest.js":
/*!***************************************!*\
  !*** ./dist/osm.interfaces.forest.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ForestColors: () => (/* binding */ ForestColors),
/* harmony export */   ForestOptions: () => (/* binding */ ForestOptions)
/* harmony export */ });
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math */ "core/math");
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _osm_interfaces__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./osm.interfaces */ "./dist/osm.interfaces.js");
/* harmony import */ var _osm_tagset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./osm.tagset */ "./dist/osm.tagset.js");
/* harmony import */ var _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./osm.colorResolver */ "./dist/osm.colorResolver.js");




class ForestColors {
}
ForestColors.DefaultColor = core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.darkgreen;
ForestColors.ColorMap = new Map([
    ["deciduous", "forestgreen"],
    ["evergreen", "darkgreen"],
    ["broadleaved", "@deciduous"],
    ["needleleaved", "@evergreen"],
    ["mixed", "#228B22"],
]);
ForestColors.Resolver = new _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__.ColorResolver(ForestColors.DefaultColor, ForestColors.ColorMap);
class ForestOptions {
    constructor() {
        this.type = "mixed";
        this.color = ForestColors.DefaultColor;
    }
    static IsForest(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_3__.OSMTagSet(record);
        return tags.readValue("natural") === ForestOptions.woodKeywords || tags.readValue("landcover") === ForestOptions.treeKeywords;
    }
    static FromTags(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_3__.OSMTagSet(record);
        if (!this.IsForest(tags)) {
            return undefined;
        }
        const o = new ForestOptions();
        o.type = tags.readValue("leaf_cycle") ?? tags.readValue("leaf_type") ?? "mixed";
        o.color = ForestColors.Resolver.getColor(o.type);
        return o;
    }
}
ForestOptions.woodKeywords = "wood";
ForestOptions.treeKeywords = "trees";
//# sourceMappingURL=osm.interfaces.forest.js.map

/***/ }),

/***/ "./dist/osm.interfaces.js":
/*!********************************!*\
  !*** ./dist/osm.interfaces.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   IsIOSMTags: () => (/* binding */ IsIOSMTags)
/* harmony export */ });
function IsIOSMTags(obj) {
    if (typeof obj !== "object" || obj === null)
        return false;
    const maybe = obj;
    return (typeof maybe.readValue === "function" &&
        typeof maybe.readInt === "function" &&
        typeof maybe.readFloat === "function" &&
        typeof maybe.readBool === "function" &&
        typeof maybe.has === "function" &&
        typeof maybe.toJSON === "function");
}
//# sourceMappingURL=osm.interfaces.js.map

/***/ }),

/***/ "./dist/osm.interfaces.road.js":
/*!*************************************!*\
  !*** ./dist/osm.interfaces.road.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RoadColors: () => (/* binding */ RoadColors),
/* harmony export */   RoadOptions: () => (/* binding */ RoadOptions),
/* harmony export */   RoadWidthMap: () => (/* binding */ RoadWidthMap)
/* harmony export */ });
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math */ "core/math");
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _osm_interfaces__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./osm.interfaces */ "./dist/osm.interfaces.js");
/* harmony import */ var _osm_tagset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./osm.tagset */ "./dist/osm.tagset.js");
/* harmony import */ var _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./osm.colorResolver */ "./dist/osm.colorResolver.js");




class RoadColors {
}
RoadColors.DefaultColor = core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.lightgray;
RoadColors.ColorMap = new Map([
    ["motorway", "#e990a0"],
    ["trunk", "#fbb29a"],
    ["primary", "#fdd7a1"],
    ["secondary", "#f6fabb"],
    ["tertiary", "#ffffff"],
    ["residential", "#ffffff"],
    ["service", "@residential"],
    ["living-street", "#ededed"],
    ["pedestrian", "#dddde8"],
    ["raceway", "pink"],
    ["road", "#ddd"],
    ["footway", "salmon"],
    ["steps", "@footway"],
    ["cycleway", "blue"],
    ["bridleway", "green"],
    ["track", "#996600"],
    ["aeroway", "#bbc"],
    ["runway", "@aeroway"],
    ["taxiway", "@aeroway"],
    ["helipad", "@aeroway"],
]);
RoadColors.Resolver = new _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__.ColorResolver(RoadColors.DefaultColor, RoadColors.ColorMap);
const RoadWidthMap = new Map([
    ["motorway", 12],
    ["trunk", 10],
    ["primary", 8],
    ["secondary", 6],
    ["tertiary", 5],
    ["residential", 4],
    ["service", 2.5],
    ["track", 2.5],
    ["cycleway", 2.5],
    ["footway", 1.5],
    ["steps", 1.5],
    ["runway", 45],
    ["taxiway", 23],
    ["helipad", 15],
]);
class RoadOptions {
    constructor() {
        this.type = "road";
        this.color = RoadColors.DefaultColor;
        this.width = 2;
    }
    static IsRoad(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_3__.OSMTagSet(record);
        return tags.has(RoadOptions.highwayKey) || tags.has(RoadOptions.aerowayKey);
    }
    static FromTags(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_3__.OSMTagSet(record);
        if (!this.IsRoad(tags)) {
            return undefined;
        }
        const o = new RoadOptions();
        const type = tags.readValue(RoadOptions.highwayKey) ?? tags.readValue(RoadOptions.aerowayKey) ?? "road";
        o.type = type;
        o.color = RoadColors.Resolver.getColor(type);
        const w = tags.readFloat("width", 0);
        o.width = w ? w : RoadWidthMap.get(type) ?? RoadOptions.DEFAULT_ROAD_WIDTH;
        return o;
    }
}
RoadOptions.DEFAULT_ROAD_WIDTH = 2;
RoadOptions.highwayKey = "highway";
RoadOptions.aerowayKey = "aeroway";
//# sourceMappingURL=osm.interfaces.road.js.map

/***/ }),

/***/ "./dist/osm.interfaces.water.js":
/*!**************************************!*\
  !*** ./dist/osm.interfaces.water.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   WaterColors: () => (/* binding */ WaterColors),
/* harmony export */   WaterOptions: () => (/* binding */ WaterOptions)
/* harmony export */ });
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core/math */ "core/math");
/* harmony import */ var core_math__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_math__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _osm_interfaces__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./osm.interfaces */ "./dist/osm.interfaces.js");
/* harmony import */ var _osm_tagset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./osm.tagset */ "./dist/osm.tagset.js");
/* harmony import */ var _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./osm.colorResolver */ "./dist/osm.colorResolver.js");




class WaterColors {
}
WaterColors.DefaultColor = core_math__WEBPACK_IMPORTED_MODULE_0__.RGBAColor.blue;
WaterColors.ColorMap = new Map([
    ["lake", "blue"],
    ["lagoon", "lightblue"],
    ["pond", "@lake"],
    ["reflecting_pool", "steelblue"],
    ["reservoir", "@lake"],
    ["basin", "@lake"],
    ["river", "@lake"],
    ["fish_pass", "@lake"],
    ["oxbow", "@lake"],
    ["lock", "@lake"],
    ["moat", "@lake"],
    ["wastewater", "lightseagreen"],
    ["stream_pool", "@lake"],
]);
WaterColors.Resolver = new _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__.ColorResolver(WaterColors.DefaultColor, WaterColors.ColorMap);
class WaterOptions {
    constructor() {
        this.color = WaterColors.DefaultColor;
        this.type = "lake";
    }
    static IsWater(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_3__.OSMTagSet(record);
        return tags.readValue("natural") === WaterOptions.waterKeyword || tags.readValue("landcover") === WaterOptions.waterKeyword;
    }
    static FromTags(record) {
        const tags = (0,_osm_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsIOSMTags)(record) ? record : new _osm_tagset__WEBPACK_IMPORTED_MODULE_3__.OSMTagSet(record);
        if (!this.IsWater(tags)) {
            return undefined;
        }
        const o = new WaterOptions();
        const waterType = tags.readValue("water") ?? "lake";
        o.type = waterType;
        o.color = WaterColors.Resolver.getColor(waterType);
        return o;
    }
}
WaterOptions.waterKeyword = "water";
//# sourceMappingURL=osm.interfaces.water.js.map

/***/ }),

/***/ "./dist/osm.tagset.js":
/*!****************************!*\
  !*** ./dist/osm.tagset.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OSMTagSet: () => (/* binding */ OSMTagSet)
/* harmony export */ });
class OSMTagSet {
    constructor(initial = {}) {
        this.raw = initial;
    }
    readValue(key) {
        const value = this.raw[key];
        return value?.trim();
    }
    readString(key, defaultValue) {
        const value = this.raw[key];
        return value?.trim() ?? defaultValue;
    }
    readInt(key, defaultValue) {
        const val = this.readValue(key);
        if (val !== undefined) {
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? defaultValue : parsed;
        }
        return defaultValue;
    }
    readFloat(key, defaultValue) {
        const val = this.readValue(key);
        if (val !== undefined) {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? defaultValue : parsed;
        }
        return defaultValue;
    }
    readBool(key, defaultValue) {
        const val = this.readValue(key)?.toLowerCase();
        if (val === undefined)
            return defaultValue;
        if (["1", "yes", "true"].includes(val))
            return true;
        if (["0", "no", "false"].includes(val))
            return false;
        return defaultValue;
    }
    has(key) {
        return Object.prototype.hasOwnProperty.call(this.raw, key);
    }
    toJSON() {
        return { ...this.raw };
    }
}
//# sourceMappingURL=osm.tagset.js.map

/***/ }),

/***/ "core/math":
/*!**************************!*\
  !*** external "SPACEXR" ***!
  \**************************/
/***/ ((module) => {

module.exports = SPACEXR;

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
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***********************!*\
  !*** ./dist/index.js ***!
  \***********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BuildingMaterialOptions: () => (/* reexport safe */ _osm_interfaces_building__WEBPACK_IMPORTED_MODULE_3__.BuildingMaterialOptions),
/* harmony export */   BuildingOptions: () => (/* reexport safe */ _osm_interfaces_building__WEBPACK_IMPORTED_MODULE_3__.BuildingOptions),
/* harmony export */   ColorResolver: () => (/* reexport safe */ _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__.ColorResolver),
/* harmony export */   ForestColors: () => (/* reexport safe */ _osm_interfaces_forest__WEBPACK_IMPORTED_MODULE_6__.ForestColors),
/* harmony export */   ForestOptions: () => (/* reexport safe */ _osm_interfaces_forest__WEBPACK_IMPORTED_MODULE_6__.ForestOptions),
/* harmony export */   IsIOSMTags: () => (/* reexport safe */ _osm_interfaces__WEBPACK_IMPORTED_MODULE_2__.IsIOSMTags),
/* harmony export */   OSMTagSet: () => (/* reexport safe */ _osm_tagset__WEBPACK_IMPORTED_MODULE_0__.OSMTagSet),
/* harmony export */   RoadColors: () => (/* reexport safe */ _osm_interfaces_road__WEBPACK_IMPORTED_MODULE_4__.RoadColors),
/* harmony export */   RoadOptions: () => (/* reexport safe */ _osm_interfaces_road__WEBPACK_IMPORTED_MODULE_4__.RoadOptions),
/* harmony export */   RoadWidthMap: () => (/* reexport safe */ _osm_interfaces_road__WEBPACK_IMPORTED_MODULE_4__.RoadWidthMap),
/* harmony export */   RoofOptions: () => (/* reexport safe */ _osm_interfaces_building__WEBPACK_IMPORTED_MODULE_3__.RoofOptions),
/* harmony export */   RoofOrientation: () => (/* reexport safe */ _osm_interfaces_building__WEBPACK_IMPORTED_MODULE_3__.RoofOrientation),
/* harmony export */   RoofShape: () => (/* reexport safe */ _osm_interfaces_building__WEBPACK_IMPORTED_MODULE_3__.RoofShape),
/* harmony export */   WaterColors: () => (/* reexport safe */ _osm_interfaces_water__WEBPACK_IMPORTED_MODULE_5__.WaterColors),
/* harmony export */   WaterOptions: () => (/* reexport safe */ _osm_interfaces_water__WEBPACK_IMPORTED_MODULE_5__.WaterOptions)
/* harmony export */ });
/* harmony import */ var _osm_tagset__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./osm.tagset */ "./dist/osm.tagset.js");
/* harmony import */ var _osm_colorResolver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./osm.colorResolver */ "./dist/osm.colorResolver.js");
/* harmony import */ var _osm_interfaces__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./osm.interfaces */ "./dist/osm.interfaces.js");
/* harmony import */ var _osm_interfaces_building__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./osm.interfaces.building */ "./dist/osm.interfaces.building.js");
/* harmony import */ var _osm_interfaces_road__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./osm.interfaces.road */ "./dist/osm.interfaces.road.js");
/* harmony import */ var _osm_interfaces_water__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./osm.interfaces.water */ "./dist/osm.interfaces.water.js");
/* harmony import */ var _osm_interfaces_forest__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./osm.interfaces.forest */ "./dist/osm.interfaces.forest.js");







//# sourceMappingURL=index.js.map
})();

SPACEXR_OSM = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=spacexr_osm.1.0.0.js.map