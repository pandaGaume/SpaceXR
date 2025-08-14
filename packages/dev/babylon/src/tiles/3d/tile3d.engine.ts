import { SourceBlock } from "core/tiles/pipeline/tiles.pipeline.sourceblock";
import { Nullable } from "core/types";
import { FetchResult, WebClient } from "core/io";
import { ICameraViewState, IDisplay, ITileAddress3 } from "core/tiles";
import { GeodeticSystem, IGeoProcessor, SphericalCalculator } from "core/geodesy";

import { BoxType, ITile3d, ITileset, Mat44Type, Point3Type, RegionType, TransformPoint3, TransformVec3 } from "./interfaces";
import { Cartesian3, ICartesian3 } from "core/geometry";
import { Tile3dWebClient } from "./tile3d.client";
import { ScreenSpaceError } from "../../map/map.object.interfaces";

export class Tile3dGeodeticOptions {
    static readonly Default: Tile3dGeodeticOptions = {
        system: GeodeticSystem.Default,
        calculator: new SphericalCalculator(GeodeticSystem.Default.ellipsoid), // Default geo-processor for region to box conversion
    };

    system?: GeodeticSystem;
    calculator?: IGeoProcessor; // Optional geo-processor for region to box conversion
}

export class Tile3dStreamingEngineOptions {
    static readonly DefaultTilesetExtension = ".json"; // Default extension for tilesets
    static readonly DefaultMaximumScreenSpaceError = 16; // Default maximum screen space error

    static readonly Default: Tile3dStreamingEngineOptions = {
        tilesetExtension: Tile3dStreamingEngineOptions.DefaultTilesetExtension,
        maximumScreenSpaceError: Tile3dStreamingEngineOptions.DefaultMaximumScreenSpaceError, // Default maximum screen space error
        geo: Tile3dGeodeticOptions.Default,
    };

    tilesetExtension?: string;
    webClient?: WebClient<ITileAddress3, ITileset>;
    maximumScreenSpaceError?: number; // Maximum screen space error for tile refinement
    geo?: Tile3dGeodeticOptions;
}

export class Tile3dStreamingEngine extends SourceBlock<ITile3d> {
    _uri: string;
    _root: Nullable<ITileset>;
    _client: WebClient<ITileAddress3, ITileset>;
    _options: Tile3dStreamingEngineOptions;

    _actives: Array<ITile3d> = []; // Active tiles in the current context
    _loadingPromises: Map<string, Promise<FetchResult<ITileAddress3, Nullable<ITileset>>>>;
    _cartesianCache: Array<Point3Type> = [
        [0, 0, 0],
        [0, 0, 0],
    ]; // Cache for Cartesian coordinates to avoid reallocating frequently
    _boxCache: Array<BoxType> = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]; // Cache for box coordinates to avoid reallocating frequently

    public constructor(uri: string, options?: Tile3dStreamingEngineOptions) {
        super();
        this._uri = uri;
        this._root = null;
        this._client = options?.webClient ?? new Tile3dWebClient(uri); // uri is used for the name of the client.
        this._options = { ...Tile3dStreamingEngineOptions.Default, ...options };
        this._loadingPromises = new Map<string, Promise<FetchResult<ITileAddress3, Nullable<ITileset>>>>();
    }

    public setContext(
        cameraState: Nullable<ICameraViewState>,
        display: IDisplay,
        bounds: RegionType // An array of six numbers that define a bounding geographic region in EPSG:4979 coordinates
    ): void {
        if (!cameraState || !bounds) {
            this._actives = [];
            return;
        }

        const system = this._options.geo?.system ?? GeodeticSystem.Default;
        const calculator = this._options.geo?.calculator ?? new SphericalCalculator(system.ellipsoid);
        const box = this._getRegionToBoxRef(bounds, system, this._boxCache[0], calculator);
        if (!this._root) {
            const clonedBox: BoxType = box.slice() as BoxType; // need to be clonned to avoid concurrent access.
            this._loadAsync(this._uri).then((tileset) => {
                if (tileset) {
                    this._root = tileset;
                    this._activateTileset(this._root, cameraState, display, clonedBox);
                }
            });
        } else {
            this._activateTileset(this._root, cameraState, display, box);
        }
    }

    protected _activateTileset(tileset: ITileset, cameraState: ICameraViewState, display: IDisplay, bounds: BoxType): void {
        if (!tileset) {
            return; // No tileset loaded
        }
        this._activateTile(tileset.root, cameraState, display, bounds, tileset.geometricError);
    }

    protected _activateTile(
        tile: ITile3d,
        cameraState: ICameraViewState,
        display: IDisplay,
        bounds: BoxType,
        geometricError?: number // inherited geometric error from the parent.
    ): void {
        if (!tile) return;

        let box = tile.boundingVolume?.box;
        if (!box) {
            const region = tile.boundingVolume?.region;
            if (region) {
                const system = this._options.geo?.system ?? GeodeticSystem.Default;
                const calculator = this._options.geo?.calculator ?? new SphericalCalculator(system.ellipsoid);
                box = this._getRegionToBoxRef(region, system, this._boxCache[1], calculator);
            } else {
                return;
            }
        }

        const transform = tile.transform as Mat44Type | undefined;

        const boxCenter: Point3Type = [box[0], box[1], box[2]];
        const worldBoxCenter = transform ? TransformPoint3(transform, boxCenter, this._cartesianCache[0]) : boxCenter;

        const viewBox = tile.viewerRequestVolume?.box;
        if (viewBox) {
            const viewCenter: Point3Type = [viewBox[0], viewBox[1], viewBox[2]];
            const worldViewCenter = transform ? TransformPoint3(transform, viewCenter, this._cartesianCache[1]) : viewCenter;

            const xAxis = TransformVec3(transform!, [viewBox[3], viewBox[4], viewBox[5]]);
            const yAxis = TransformVec3(transform!, [viewBox[6], viewBox[7], viewBox[8]]);
            const zAxis = TransformVec3(transform!, [viewBox[9], viewBox[10], viewBox[11]]);

            const dx = cameraState.position.x - worldViewCenter[0];
            const dy = cameraState.position.y - worldViewCenter[1];
            const dz = cameraState.position.z - worldViewCenter[2];

            const proj = (a: number[], bx: number, by: number, bz: number) => Math.abs(a[0] * bx + a[1] * by + a[2] * bz);
            const len = (a: number[]) => Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);

            if (proj(xAxis, dx, dy, dz) > len(xAxis) || proj(yAxis, dx, dy, dz) > len(yAxis) || proj(zAxis, dx, dy, dz) > len(zAxis)) {
                return; // camera is outside viewer request volume
            }
        }

        const dx = worldBoxCenter[0] - cameraState.position.x;
        const dy = worldBoxCenter[1] - cameraState.position.y;
        const dz = worldBoxCenter[2] - cameraState.position.z;
        const distanceToCamera = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const tileGeometricError = tile.geometricError ?? geometricError;
        const sse = ScreenSpaceError(tileGeometricError, distanceToCamera, display.resolution.height, cameraState.tanfov2);
        const maxsse = this._options.maximumScreenSpaceError ?? Tile3dStreamingEngineOptions.DefaultMaximumScreenSpaceError;

        if (sse > maxsse) {
            const contents = tile.content ? [tile.content] : tile.contents;

            let hasExternalTileset = false;
            if (contents && contents.length > 0) {
                for (const content of contents) {
                    const uri = content.uri;
                    if (uri && uri.toLowerCase().endsWith((this._options.tilesetExtension ?? Tile3dStreamingEngineOptions.DefaultTilesetExtension).toLowerCase())) {
                        hasExternalTileset = true;
                        this._loadAsync(uri).then((tileset) => {
                            if (tileset) {
                                this._activateTileset(tileset, cameraState, display, bounds);
                            }
                        });
                    }
                }
            }

            if (!hasExternalTileset && tile.children && tile.children.length > 0) {
                for (const child of tile.children) {
                    this._activateTile(child, cameraState, display, bounds, tileGeometricError);
                }
            }
            return;
        }
    }

    protected async _loadAsync(uri: string): Promise<Nullable<ITileset>> {
        if (!this._loadingPromises.has(uri)) {
            const loadingPromise = this._client.fetchAsync({ tileId: uri });
            this._loadingPromises.set(uri, loadingPromise);
            try {
                const result = await loadingPromise;
                if (result.content) {
                    return result.content;
                }
            } catch (error) {
                console.error(`Failed to load tileset ${uri}:`, error);
            } finally {
                this._loadingPromises.delete(uri); // allow future retries if needed
            }
        }
        return null;
    }

    protected _getRegionCenterToCartesianRef(region: RegionType, system: GeodeticSystem, target: ICartesian3): ICartesian3 {
        const lonCenter = (region[0] + region[2]) / 2; // radians
        const latCenter = (region[1] + region[3]) / 2; // radians
        const heightCenter = (region[4] + region[5]) / 2; // meters
        return system.geodeticFloatToCartesianToRef(latCenter, lonCenter, heightCenter, target, false); // false means radians
    }

    protected _getRegionToBoxRef(region: RegionType, system: GeodeticSystem, target: BoxType, proc?: IGeoProcessor): BoxType {
        const west = region[0];
        const south = region[1];
        const east = region[2];
        const north = region[3];
        const minHeight = region[4];
        const maxHeight = region[5];

        const lonCenter = (west + east) / 2;
        const latCenter = (south + north) / 2;
        const heightCenter = (minHeight + maxHeight) / 2;

        // Centre en géodésique
        const calculator = proc ?? new SphericalCalculator(system.ellipsoid);
        const centerCartesian = system.geodeticFloatToCartesianToRef(latCenter, lonCenter, heightCenter, Cartesian3.Zero(), false);
        target[0] = centerCartesian.x;
        target[1] = centerCartesian.y;
        target[2] = centerCartesian.z;

        // Taille réelle des demi-axes (en mètres)
        const eastWestSize = calculator.getDistanceFromFloat(latCenter, west, latCenter, east, 0, 0, false); // m
        const northSouthSize = calculator.getDistanceFromFloat(south, lonCenter, north, lonCenter, 0, 0, false); // m
        const heightSize = maxHeight - minHeight; // m

        const halfX = eastWestSize / 2;
        const halfY = northSouthSize / 2;
        const halfZ = heightSize / 2;

        // Vecteur Est (X axis)
        const azimuthX = 90; // Est géographique
        const geoX = calculator.getLocationAtDistanceAzimuth(latCenter, lonCenter, halfX, azimuthX, false);
        const xEnd = system.geodeticFloatToCartesianToRef(geoX.lat, geoX.lon, heightCenter, Cartesian3.Zero(), false);
        target[3] = xEnd.x - centerCartesian.x;
        target[4] = xEnd.y - centerCartesian.y;
        target[5] = xEnd.z - centerCartesian.z;

        // Vecteur Nord (Y axis)
        const azimuthY = 0; // Nord géographique
        const geoY = calculator.getLocationAtDistanceAzimuth(latCenter, lonCenter, halfY, azimuthY);
        const yEnd = system.geodeticFloatToCartesianToRef(geoY.lat, geoY.lon, heightCenter, Cartesian3.Zero(), false);
        target[6] = yEnd.x - centerCartesian.x;
        target[7] = yEnd.y - centerCartesian.y;
        target[8] = yEnd.z - centerCartesian.z;

        // Vecteur vertical (Z axis)
        const zEnd = system.geodeticFloatToCartesianToRef(latCenter, lonCenter, heightCenter + halfZ, Cartesian3.Zero(), false);
        target[9] = zEnd.x - centerCartesian.x;
        target[10] = zEnd.y - centerCartesian.y;
        target[11] = zEnd.z - centerCartesian.z;

        return target;
    }
}
