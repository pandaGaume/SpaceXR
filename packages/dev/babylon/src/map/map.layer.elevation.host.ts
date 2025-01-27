import { AbstractMesh, Material, Mesh, Scene, TransformNode } from "@babylonjs/core";
import {
    IDisplay,
    ImageLayerContentType,
    IPhysicalDisplay,
    IsPhysicalDisplay,
    IsTargetBlock,
    ITile,
    ITileMapLayer,
    ITileMetrics,
    ITileNavigationState,
    ITileView,
    TileMapLayerView,
    TileNavigationState,
} from "core/tiles";
import { Nullable } from "core/types";
import { IMap3D, ITileWithMesh } from "./map.interfaces";
import { ICartesian2, ISize2, IsSize, Size2 } from "core/geometry";
import { TileWithElevation } from "./map.tile";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { DEMLayerView } from "./map.layer.dem";
import { IDemInfos } from "core/dem";

export class ElevationHost<T extends ImageLayerContentType> extends TileMapLayerView<T> {
    public static DefaultExageration: number = 1.0;

    public static ROOT_SUFFIX = "root";

    // the owner
    _map: IMap3D;

    // the root of the tiles instances
    _tilesRoot: TransformNode;

    // the dem layers
    _demLayerViews: Array<DEMLayerView<IDemInfos>> = [];

    // cached cartesian center
    _cartesianCenterCache: Nullable<ICartesian2> = null;
    _cachedSize: ISize2;

    public constructor(map: IMap3D, layer: ITileMapLayer<T>, display: Nullable<IDisplay>, source: ITileView) {
        super(layer, display, source);
        // ensure factory is with correct type.
        this.factory.withType(TileWithElevation);

        this._map = map;

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

    public get map(): IMap3D {
        return this._map;
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

    public bindElevationLayer(view: DEMLayerView<IDemInfos>): void {
        // Check if the view is already in the array
        if (!this._demLayerViews.includes(view)) {
            this._demLayerViews.push(view);
            for (const t of this._activTiles) {
                if (IsTargetBlock<ITile<IDemInfos>>(t)) {
                    view.linkTo(t);
                }
            }
        }
    }

    public unbindElevationLayer(view: DEMLayerView<IDemInfos>): void {
        // Check if the view is in the array
        const index = this._demLayerViews.indexOf(view);
        if (index !== -1) {
            this._demLayerViews.splice(index, 1);
            for (const t of this._activTiles) {
                if (IsTargetBlock<ITile<IDemInfos>>(t)) {
                    view.unlinkFrom(t);
                }
            }
        }
    }

    protected get isReady(): boolean {
        return this._tilesRoot !== null && this._tilesRoot !== undefined;
    }

    protected _buildRoot(scene?: Scene): TransformNode {
        return new TransformNode(this._buildRootName(), scene);
    }

    protected _onTileAdded(tile: TileWithElevation<T>): void {
        const m = this._buildInstance(tile);
        if (m) {
            m.parent = this._tilesRoot;

            m.scaling.x = m.scaling.y = this.metrics.tileSize;
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
            for (const v of this._demLayerViews) {
                v.linkTo(tile);
            }
        }
    }

    protected _onTileRemoved(tile: TileWithElevation<T>): void {
        if (tile.surface) {
            tile.surface.dispose();
            tile.surface = null;
            for (const v of this._demLayerViews) {
                v.unlinkFrom(tile);
            }
        }
    }

    protected _onTileUpdated(tile: TileWithElevation<T>): void {
        if (tile.surface) {
            tile.surface.setEnabled(tile.content !== null && tile.content !== undefined);
        }
    }

    protected _buildInstance(tile: ITileWithMesh<T>): AbstractMesh {
        const instance = this._map.grid.createInstance(this._buildInstanceName(tile));
        return instance;
    }

    protected _setTilePosition(tile: ITileWithMesh<T>, center: ICartesian2): void {
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

    protected _setScale(nav: ITileNavigationState, display: IPhysicalDisplay, layer: ITileMapLayer<T>, metrics: ITileMetrics) {
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
        this._tilesRoot.scaling.z = z * (this._map.elevationOptions?.exageration ?? ElevationHost.DefaultExageration) * nav.scale;
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
                    this._setTilePosition(tile as ITileWithMesh<T>, center);
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

    protected _buildRootName(): string {
        return `${this.layer.name}-${ElevationHost.ROOT_SUFFIX}`;
    }

    protected _buildInstanceName(tile: ITileWithMesh<T>): string {
        return tile.quadkey;
    }
}
