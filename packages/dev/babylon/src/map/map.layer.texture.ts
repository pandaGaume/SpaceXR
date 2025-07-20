import { AbstractMesh, Material, Mesh, Scene, TransformNode } from "@babylonjs/core";
import {
    AbstractTileMetrics,
    IDisplay,
    ImageLayerContentType,
    IPhysicalDisplay,
    IsPhysicalDisplay,
    ITileMapLayer,
    ITileMetrics,
    ITileNavigationState,
    ITileView,
    TileNavigationState,
} from "core/tiles";
import { Nullable } from "core/types";
import { IMap3D, ITileWithMesh } from "./map.interfaces";
import { ICartesian2, ISize2, IsSize, Size2 } from "core/geometry";
import { TileWithElevation } from "./map.tile";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { Map3dLayerView } from "./map.layer.view";

export class TextureLayerView extends Map3dLayerView<ImageLayerContentType> {
    public static DefaultExageration: number = 1.0;

    public static ROOT_SUFFIX = "root";

    // the root of the tiles instances
    _tilesRoot: TransformNode;

    // cached cartesian center
    _cartesianCenterCache: Nullable<ICartesian2> = null;
    _cachedSize: ISize2;

    public constructor(map: IMap3D, layer: ITileMapLayer<ImageLayerContentType>, display: Nullable<IDisplay>, source: ITileView) {
        super(map, layer, display, source);
        // ensure factory is with correct type.
        this.factory.withType(TileWithElevation);

        const gridSize = map.elevationOptions?.gridSize;
        if (IsSize(gridSize)) {
            this._cachedSize = gridSize;
        } else {
            const d = gridSize;
            this._cachedSize = new Size2(d, d);
        }

        // build the root for the tiles
        const scene = this._map.root.getScene();
        this._tilesRoot = this._buildRoot(scene);
    }

    public get grid(): Mesh {
        return this._map.grid;
    }

    public get material(): Nullable<Material> {
        return this._map.grid.material;
    }

    public get name(): string {
        return this._tilesRoot.name;
    }

    public get tilesRoot(): TransformNode {
        return this._tilesRoot;
    }

    public dispose(): void {
        super.dispose();
    }

    protected get isReady(): boolean {
        return this._tilesRoot !== null && this._tilesRoot !== undefined;
    }

    protected _buildRoot(scene?: Scene): TransformNode {
        return new TransformNode(this._buildRootName(), scene);
    }

    protected _onTileAdded(tile: TileWithElevation<ImageLayerContentType>): void {
        const m = this._buildInstance(tile);
        if (m) {
            m.parent = this._tilesRoot;

            m.scaling.x = m.scaling.y = this.metrics?.tileSize ?? AbstractTileMetrics.DefaultTileSize;
            m.scaling.z = 1.0; // exageration is hold by the tiles root scaling.

            // set the surface 3D
            tile.surface = m;
            tile.gridSize = this._cachedSize;

            if (!tile.content) {
                m.setEnabled(false);
            }
            const center = this._getCenter(true);
            if (center) {
                this._setTilePosition(tile, center);
            }
        }
    }

    protected _onTileRemoved(tile: TileWithElevation<ImageLayerContentType>): void {
        if (tile.surface) {
            tile.surface.dispose();
            tile.surface = null;
        }
    }

    protected _onTileUpdated(tile: TileWithElevation<ImageLayerContentType>): void {
        if (tile.surface) {
            tile.surface.setEnabled(tile.content !== null && tile.content !== undefined);
        }
    }

    protected _buildInstance(tile: ITileWithMesh<ImageLayerContentType>): AbstractMesh {
        const instance = this._map.grid.createInstance(this._buildInstanceName(tile));
        return instance;
    }

    protected _setTilePosition(tile: ITileWithMesh<ImageLayerContentType>, center: ICartesian2): void {
        if (tile?.boundingBox && tile?.surface) {
            const c = tile.boundingBox.center;
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

    protected _setScale(nav: ITileNavigationState, display: IPhysicalDisplay, layer: ITileMapLayer<ImageLayerContentType>, metrics: ITileMetrics) {
        const groundResolution = metrics.groundResolution(nav.center.lat, nav.lod);
        const x = display.dimension.width / (display.resolution.width * groundResolution);
        const y = display.dimension.height / (display.resolution.height * groundResolution);
        let z = Math.max(x, y);
        if (display.dimension.depth && display.resolution.depth) {
            z = display.dimension.depth / (display.resolution.depth * groundResolution);
        }

        // x & y are unitless, so we define the size in meter using scale and groundResolution
        this._tilesRoot.scaling.x = x * groundResolution * nav.scale;
        this._tilesRoot.scaling.y = y * groundResolution * nav.scale;

        // z data are already in meter so they just need to be scaled, and exagerated.
        this._tilesRoot.scaling.z = z * (this._map.elevationOptions?.exageration ?? TextureLayerView.DefaultExageration) * nav.scale;
    }

    protected _onNavigationChanged(oldValue: Nullable<ITileNavigationState>, newValue: Nullable<ITileNavigationState>): void {
        if (newValue && newValue !== oldValue) {
            this._applyNavigation(newValue);
        }
    }

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
        if (this.isReady && IsPhysicalDisplay(this.display) && this.metrics) {
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
                    this._setTilePosition(tile as ITileWithMesh<ImageLayerContentType>, center);
                }
            }
        }
    }

    protected _getCenter(force: boolean = false): ICartesian2 | undefined {
        const nav = this.navigationState;
        if (nav && this.metrics) {
            if (force || !this._cartesianCenterCache) {
                const geo = nav.center;
                this._cartesianCenterCache = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, nav.lod);
            }
            return this._cartesianCenterCache;
        }
        return undefined;
    }

    protected _buildRootName(): string {
        return `${this.layer.name}-${TextureLayerView.ROOT_SUFFIX}`;
    }

    protected _buildInstanceName(tile: ITileWithMesh<ImageLayerContentType>): string {
        return tile.quadkey;
    }
}
