import { SourceBlock } from "core/tiles/pipeline/tiles.pipeline.sourceblock";
import { Nullable } from "core/types";
import { FetchResult, WebClient } from "core/io";
import { CameraState, ICameraState, IDisplay, ITileNavigationState } from "core/tiles";
import { Envelope } from "core/geography";
import { GeodeticSystem, IGeoProcessor, SphericalCalculator } from "core/geodesy";

import { BoxType, ITile, ITileset, RegionType } from "./interfaces";
import { Tile3dCodec } from "./codecs";
import { Cartesian3, ICartesian3 } from "core/geometry";

///<summary>
/// Computes the screen space error (SSE) for a tile based on its geometric error,
/// the distance to the camera, the viewport height, and the tangent of half the field of view.
///</summary>
export function ScreenSpaceError(tileGeometricError: number, distanceToCamera: number, viewportHeight: number, tanfov2: number): number {
    return (tileGeometricError * viewportHeight) / (distanceToCamera * tanfov2);
}

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
    webClient?: WebClient<string, ITileset>;
    maximumScreenSpaceError?: number; // Maximum screen space error for tile refinement
    geo?: Tile3dGeodeticOptions;
}

export class Tile3dStreamingEngine extends SourceBlock<ITile> {
    _uri: string;
    _root: Nullable<ITileset>;
    _client: WebClient<string, ITileset>;
    _options: Tile3dStreamingEngineOptions;

    _actives: Array<ITile> = []; // Active tiles in the current context
    _loadingPromises: Map<string, Promise<FetchResult<string, Nullable<ITileset>>>>;
    _cartesianCache: ICartesian3[] = [Cartesian3.Zero(), Cartesian3.Zero()]; // Cache for Cartesian coordinates to avoid reallocating frequently
    _boxCache: Array<BoxType> = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]; // Cache for box coordinates to avoid reallocating frequently

    public constructor(uri: string, options?: Tile3dStreamingEngineOptions) {
        super();
        this._uri = uri;
        this._root = null;
        this._client = options?.webClient ?? new WebClient<string, ITileset>(uri, new Tile3dCodec()); // uri is used for the name of the client.
        this._options = { ...Tile3dStreamingEngineOptions.Default, ...options };
        this._loadingPromises = new Map<string, Promise<FetchResult<string, Nullable<ITileset>>>>();
    }

    public setContext(
        cameraState: Nullable<ICameraState>,
        navigationState: Nullable<ITileNavigationState>,
        display: IDisplay,
        bounds: [number, number, number, number, number, number]
    ): void {
        if (!cameraState || !bounds) {
            this._actives = [];
            return;
        }
        if (!this._root) {
            this._loadAsync(this._uri).then((tileset) => {
                if (tileset) {
                    this._root = tileset;
                    this._activateTileset(this._root, cameraState, navigationState, display, bounds);
                }
            });
        } else {
            this._activateTileset(this._root, cameraState, navigationState, display, bounds);
        }
    }

    protected _activateTileset(
        tileset: ITileset,
        cameraState: ICameraState,
        navigationState: Nullable<ITileNavigationState>,
        display: IDisplay,
        bounds: [number, number, number, number, number, number]
    ): void {
        if (!tileset) {
            return; // No tileset loaded
        }
        this._activateTile(tileset.root, cameraState, navigationState, display, bounds, tileset.geometricError);
    }

    protected _activateTile(
        tile: ITile,
        cameraState: ICameraState,
        navigationState: Nullable<ITileNavigationState>,
        display: IDisplay,
        bounds: RegionType, // [west, south, east, north, minimum height, maximum height]
        geometricError?: number // inherited geometric error from the parent.
    ): void {
        if (!tile) {
            return; // No tileset loaded
        }
        const region = tile.boundingVolume?.region;
        if (!region) {
            return; // No bounding volume defined
        }

        if (Envelope.RegionIntersectsRegion(bounds, region)) {
            if (tile.viewerRequestVolume) {
                // If the tile has a viewer request volume, we check if the camera is within that volume.
                const viewerRegion = tile.viewerRequestVolume.region;
                if (viewerRegion) {
                    // TODO : If the camera is not within the viewer request volume, we skip this tile.
                    // const box = this._getRegionToBoxRef(viewerRegion, system, this._boxCache[0]);
                }
            }

            const tileGeometricError = tile.geometricError ?? geometricError;
            const system = this._options.geo?.system ?? GeodeticSystem.Default;
            // here we decided to not trust the sored geometry such box.
            // we compute the center of the tile region in radians
            // and compute the distance to the camera.
            // we may find a strategy to use the box in the future, where the cartesian center is already defined.
            // ideally we may compute our own box from the region at loading time.
            // we may introduce a computedBox property in the tile interface.
            const center = this._getRegionCenterToCartesianRef(region, system, this._cartesianCache[0]);
            let scale = navigationState?.mapscale ?? CameraState.DefaultScale;
            scale = scale < 0 ? CameraState.DefaultScale : scale; // Ensure scale is positive & non zero
            const distanceToCamera = Cartesian3.Distance(center, cameraState.position) / scale; // scale is used to adjust the distance based on the observed scene size
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
                            // Load external tileset and activate its root
                            this._loadAsync(uri).then((tileset) => {
                                if (tileset) {
                                    this._activateTileset(tileset, cameraState, navigationState, display, bounds);
                                }
                            });
                        }
                    }
                }

                // we have to refine if it's not a leaf tile
                if (!hasExternalTileset && tile.children && tile.children.length > 0) {
                    for (const child of tile.children) {
                        this._activateTile(child, cameraState, navigationState, display, bounds, tileGeometricError);
                    }
                }
                return; // No need to add this tile, it will be refined
            }

            if (!this._actives.includes(tile)) {
                this._actives.push(tile);
            }
        }
    }

    protected async _loadAsync(uri: string): Promise<Nullable<ITileset>> {
        if (!this._loadingPromises.has(uri)) {
            const loadingPromise = this._client.fetchAsync(this._uri);
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
        const centerCartesian = system.geodeticFloatToCartesianToRef(latCenter, lonCenter, heightCenter, this._cartesianCache[0], false);
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
        const xEnd = system.geodeticFloatToCartesianToRef(geoX.lat, geoX.lon, heightCenter, this._cartesianCache[1], false);
        target[3] = xEnd.x - centerCartesian.x;
        target[4] = xEnd.y - centerCartesian.y;
        target[5] = xEnd.z - centerCartesian.z;

        // Vecteur Nord (Y axis)
        const azimuthY = 0; // Nord géographique
        const geoY = calculator.getLocationAtDistanceAzimuth(latCenter, lonCenter, halfY, azimuthY);
        const yEnd = system.geodeticFloatToCartesianToRef(geoY.lat, geoY.lon, heightCenter, this._cartesianCache[1], false);
        target[6] = yEnd.x - centerCartesian.x;
        target[7] = yEnd.y - centerCartesian.y;
        target[8] = yEnd.z - centerCartesian.z;

        // Vecteur vertical (Z axis)
        const zEnd = system.geodeticFloatToCartesianToRef(latCenter, lonCenter, heightCenter + halfZ, this._cartesianCache[1], false);
        target[9] = zEnd.x - centerCartesian.x;
        target[10] = zEnd.y - centerCartesian.y;
        target[11] = zEnd.z - centerCartesian.z;

        return target;
    }
}
