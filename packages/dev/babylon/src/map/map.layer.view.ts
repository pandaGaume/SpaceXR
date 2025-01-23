import { AbstractMesh, Scene, TransformNode } from "@babylonjs/core";
import {
    IDisplay,
    IImageTileMapLayer,
    ImageLayerContentType,
    IPhysicalDisplay,
    IsPhysicalDisplay,
    ITileMapLayer,
    ITileMetrics,
    ITileNavigationState,
    ITileView,
    TileMapLayerView,
    TileNavigationState,
} from "core/tiles";
import { Nullable } from "core/types";
import { IElevationHost, ITileMapLayerViewWithElevation, ITileWithElevation } from "./map.interfaces";
import { Map3D } from "./map";
import { ICartesian2 } from "core/geometry";
import { TileWithElevation } from "./map.tile";
import { EventState, PropertyChangedEventArgs } from "core/events";

export class TileMapLayerViewWithElevation extends TileMapLayerView<ImageLayerContentType> implements ITileMapLayerViewWithElevation {
    _tilesRoot: TransformNode;
    _elevationHost: IElevationHost;
    // cached cartesian center
    _cartesianCenterCache: Nullable<ICartesian2> = null;

    public constructor(host: IElevationHost, layer: IImageTileMapLayer, display: Nullable<IDisplay>, source: ITileView, scene?: Scene) {
        super(layer, display, source);
        this._elevationHost = host;
        // ensure factory is with correct type.
        this.factory.withType(TileWithElevation);
        this._tilesRoot = this._buildRoot(scene);
    }

    public get elevationHost(): IElevationHost {
        return this._elevationHost;
    }

    public get tilesRoot(): TransformNode {
        return this._tilesRoot;
    }

    public get exageration(): number {
        return 1;
    }

    protected get isReady(): boolean {
        return this._tilesRoot !== null && this._tilesRoot !== undefined;
    }

    protected _buildRoot(scene?: Scene): TransformNode {
        return new TransformNode(this._buildRootName(), scene);
    }

    protected _buildRootName(): string {
        return `${this.layer.name}-root`;
    }

    protected _onTilesAdded(tiles: Array<TileWithElevation>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileAdded(t);
                }
            });
        } else {
            super._onTilesAdded(tiles);
        }
    }

    protected _onTileAdded(tile: TileWithElevation): void {
        const m = this._buildInstance(tile);
        if (m) {
            m.parent = this._tilesRoot;

            m.scaling.x = m.scaling.y = this.metrics.tileSize;
            m.scaling.z = 1.0; // exageration is hold by the tiles root scaling.

            // set the surface 3D
            tile.surface = m;

            if (!tile.content) {
                m.setEnabled(false);
            }
            const center = this._getCenter(true);
            if (center) {
                this._setTilePosition(tile, center);
            }
        }
        this.elevationHost.material?.addTile(tile, this);
    }

    protected _onTilesRemoved(tiles: Array<TileWithElevation>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileRemoved(t);
                }
            });
        } else {
            super._onTilesRemoved(tiles);
        }
    }

    protected _onTileRemoved(tile: TileWithElevation): void {
        if (tile.surface) {
            tile.surface.dispose();
            tile.surface = null;
        }
        this.elevationHost.material?.removeTile(tile, this);
    }

    protected _onTilesUpdated(tiles: Array<TileWithElevation>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileUpdated(t);
                }
            });
        } else {
            super._onTilesUpdated(tiles);
        }
    }

    protected _onTileUpdated(tile: TileWithElevation): void {
        if (tile.surface) {
            tile.surface.setEnabled(tile.content !== null && tile.content !== undefined);
        }
        this.elevationHost.material?.updateTile(tile, this);
    }

    protected _buildInstance(tile: TileWithElevation): AbstractMesh {
        const instance = this._elevationHost.grid.createInstance(this._buildInstanceName(tile));
        return instance;
    }

    protected _buildInstanceName(tile: TileWithElevation): string {
        const k = tile.quadkey;
        return k != "" ? k : Map3D.INSTANCE_ROOT_NAME;
    }

    protected _setTilePosition(tile: ITileWithElevation, center: ICartesian2): void {
        if (tile?.bounds && tile?.surface) {
            const c = tile.bounds.center;
            const p = tile.surface.position;
            // the tile system is origin north-west corner, y pointing to the south, x to the east.
            p.x = center.x - c.x;
            p.y = center.y - c.y;
            p.z = 0;
        }
    }

    protected _applyNavigation(nav: Nullable<ITileNavigationState>) {
        if (nav) {
            this._onCenterChanged();
            this._onZoomChanged();
        }
    }

    private _setScale(nav: ITileNavigationState, display: IPhysicalDisplay, layer: ITileMapLayer<ImageLayerContentType>, metrics: ITileMetrics) {
        const groundResolution = metrics.groundResolution(nav.center.lat, nav.lod);
        const x = display.dimension.width / (display.resolution.width * groundResolution);
        const y = display.dimension.height / (display.resolution.height * groundResolution);
        let z = Math.max(x, y);
        if (display.dimension.thickness && display.resolution.thickness) {
            z = display.dimension.thickness / (display.resolution.thickness * groundResolution);
        }

        // x & y are unitless, so we define the size in meter using scale and groundResolution
        this._tilesRoot.scaling.x = x * groundResolution * nav.scale;
        this._tilesRoot.scaling.y = y * groundResolution * nav.scale;

        // z data are already in meter so they just need to be scaled, and exagerated.
        this._tilesRoot.scaling.z = z * this.exageration * nav.scale;
    }

    protected _onNavigationChanged(oldValue: Nullable<ITileNavigationState>, newValue: Nullable<ITileNavigationState>): void {
        if (newValue && newValue !== oldValue) {
            this._applyNavigation(newValue);
        }
    }
    /*
        private _setPosition(x: number, y: number, z: number) {
        this._tilesRoot.position.set(x, y, z);
    }

    
    
    protected _onLayerPropertyChanged(eventData: PropertyChangedEventArgs<unknown, unknown>, eventState: EventState): void {
        // we survey the weight property of the layer to update the current view and messaging the map container that it need
        // to sort the layers again.
        if (IsElevationLayer(eventData.source)) {
            switch (eventData.propertyName) {
                case ElevationLayer.ExagerationPropertyName: {
                    this._onZoomChanged();
                    break;
                }
                case ElevationLayer.OffsetsPropertyName: {
                    const insets = eventData.source.offsets;
                    if (insets) {
                        this._setPosition(insets.x, insets.y, insets.z);
                    }
                    break;
                }
            }
        }
        super._onLayerPropertyChanged(eventData, eventState);
    }*/

    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case TileNavigationState.CENTER_PROPERTY_NAME: {
                this._cartesianCenterCache = null; // invalidate the cache
                this._onCenterChanged();
                this._onZoomChanged(); // scale is function of the latitude
                break;
            }
            case TileNavigationState.ZOOM_PROPERTY_NAME: {
                this._onZoomChanged();
                break;
            }
        }
        super._onNavigationPropertyChanged(event, state);
    }

    protected _onZoomChanged(): void {
        if (this.isReady && IsPhysicalDisplay(this.display)) {
            this._setScale(this.navigationState!, this.display, this.layer, this.metrics);
        }
    }

    protected _onCenterChanged(): void {
        if (this.isReady) {
            const tiles = this._activTiles;
            if (!tiles || !tiles.count) {
                return;
            }

            const center = this._getCenter(true);
            if (center) {
                for (const tile of tiles) {
                    this._setTilePosition(tile as ITileWithElevation, center);
                }
            }
        }
    }

    protected _getCenter(force: boolean = false): ICartesian2 | undefined {
        const nav = this.navigationState;
        if (nav) {
            if (force || !this._cartesianCenterCache) {
                const geo = nav.center;
                this._cartesianCenterCache = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, nav.lod);
            }
            return this._cartesianCenterCache;
        }
        return undefined;
    }
}
