import { AbstractMesh, Material, Mesh, Scene, TransformNode, VertexData } from "@babylonjs/core";
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
import { IElevationGridFactory, IElevationHost, IElevationOptions, IMap3DMaterial, ITileWithMesh } from "./map.interfaces";
import { ICartesian2, IsSize } from "core/geometry";
import { TileWithMesh } from "./map.tile";
import { EventState, Observer, PropertyChangedEventArgs } from "core/events";
import { ElevationGridFactory } from "./map.grid.factory";
import { TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { TextUtils } from "core/utils";
import { Map3dMaterial } from "../materials";
import { IsHolographicBounds } from "../display";

export class ElevationHost<T extends ImageLayerContentType> extends TileMapLayerView<T> implements IElevationHost {
    public static DefaultExageration: number = 1.0;
    public static TEMPLATE_SUFFIX = "grid";
    public static MATERIAL_SUFFIX = "material";
    public static INSTANCE_ROOT_NAME = "root";

    // the root of the tiles instances
    _tilesRoot: TransformNode;

    // the grid model
    _grid: Mesh;
    _material: IMap3DMaterial<T>;
    _elevationOptions: IElevationOptions;

    // properties observers
    _elevationLayerObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>> = null;

    // cached cartesian center
    _cartesianCenterCache: Nullable<ICartesian2> = null;

    public constructor(root: TransformNode, options: IElevationOptions, layer: ITileMapLayer<T>, display: Nullable<IDisplay>, source: ITileView) {
        super(layer, display, source);

        this._elevationOptions = options;

        // build the root for the tiles
        const scene = root.getScene();
        this._tilesRoot = this._buildRoot(scene);
        // set the parent
        this._tilesRoot.parent = root;

        const o = this._buildTerrainGridOptions();
        this._grid = this._buildTemplate(o, scene);
        this._material = this._buildMaterial(this._buildMaterialName() ?? this.name, scene);
        if (this._material) {
            if (IsTargetBlock<ITile<T>>(this._material.imagesTarget)) {
                this.linkTo(this._material.imagesTarget);
            }
            if (this._material instanceof Material) {
                this._grid.material = this._material;
            }
            if (display) {
                this._bindDisplayInternal(display);
            }
        }
        this._grid.setEnabled(false);

        // ensure factory is with correct type.
        this.factory.withType(TileWithMesh);
    }

    public get name(): string {
        return this._tilesRoot.name;
    }

    public get grid(): Mesh {
        return this._grid;
    }

    public get tilesRoot(): TransformNode {
        return this._tilesRoot;
    }
    public get elevationOptions(): IElevationOptions {
        return this._elevationOptions;
    }

    public get material(): IMap3DMaterial<T> {
        return this._material;
    }

    public get exageration(): number {
        return this._elevationOptions?.exageration ?? ElevationHost.DefaultExageration;
    }

    public dispose(): void {
        super.dispose();
        this._elevationLayerObserver?.disconnect();
        this._elevationLayerObserver = null;
    }

    protected get isReady(): boolean {
        return this._tilesRoot !== null && this._tilesRoot !== undefined;
    }

    protected _buildRoot(scene?: Scene): TransformNode {
        return new TransformNode(this._buildRootName(), scene);
    }

    protected _onTileAdded(tile: ITileWithMesh<T>): void {
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
    }

    protected _onTileRemoved(tile: ITileWithMesh<T>): void {
        if (tile.surface) {
            tile.surface.dispose();
            tile.surface = null;
        }
    }

    protected _onTileUpdated(tile: ITileWithMesh<T>): void {
        if (tile.surface) {
            tile.surface.setEnabled(tile.content !== null && tile.content !== undefined);
        }
    }

    protected _buildInstance(tile: ITileWithMesh<T>): AbstractMesh {
        const instance = this.grid.createInstance(this._buildInstanceName(tile));
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

    private _setScale(nav: ITileNavigationState, display: IPhysicalDisplay, layer: ITileMapLayer<T>, metrics: ITileMetrics) {
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
        this._tilesRoot.scaling.z = z * (this.exageration ?? ElevationHost.DefaultExageration) * nav.scale;
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

    protected _buildMaterial(name: string, scene?: Scene): IMap3DMaterial<T> {
        return new Map3dMaterial<T>(name, scene);
    }

    protected _buildTemplate(options: TerrainGridOptions, scene?: Scene): Mesh {
        const mesh = this._buildMesh(this._buildTemplateName() ?? this.name, scene);
        const gridFactory = this._buildGridFactory() ?? this._buildGridFactoryInternal();
        const grid = gridFactory.buildTopology(options);
        if (grid instanceof VertexData) {
            grid.applyToMesh(mesh);
        } else {
            const data = new VertexData();
            data.indices = grid.indices;
            data.normals = grid.normals;
            data.positions = grid.positions;
            data.uvs = grid.uvs;
            data.applyToMesh(mesh);
        }
        return mesh;
    }

    protected _buildTerrainGridOptions(): TerrainGridOptions {
        let w = TerrainGridOptions.DefaultGridSize;
        let h = TerrainGridOptions.DefaultGridSize;
        if (this._elevationOptions?.gridSize) {
            if (IsSize(this._elevationOptions.gridSize)) {
                w = this._elevationOptions.gridSize.width;
                h = this._elevationOptions.gridSize.height;
            } else {
                w = this._elevationOptions.gridSize;
                h = this._elevationOptions.gridSize;
            }
        }

        return new TerrainGridOptionsBuilder()
            .withColumns(w + 1)
            .withRows(h + 1)
            .withUvs(true)
            .withNormals(false)
            .build();
    }

    protected _buildMesh(name: string, scene?: Scene): Mesh {
        const mesh = new Mesh(name, scene);
        return mesh;
    }

    protected _buildGridFactory(): IElevationGridFactory {
        return this._buildGridFactoryInternal();
    }

    protected _onDisplayChanged(oldValue: Nullable<IDisplay>, newValue: Nullable<IDisplay>): void {
        this._bindDisplayInternal(newValue);
        this.invalidate();
    }

    protected _buildQualifiedName(n: string): string {
        if (this.name && this.name !== "") {
            return `${this._tilesRoot.name}:${n}`;
        }
        return n;
    }

    protected _buildRootName(): string {
        return `${this.layer.name}-root`;
    }

    protected _buildInstanceName(tile: ITileWithMesh<T>): string {
        const k = tile.quadkey;
        return k != "" ? k : ElevationHost.INSTANCE_ROOT_NAME;
    }

    protected _buildTemplateName(): string {
        return this._buildQualifiedName(TextUtils.BuildNameWithSuffix(this.name, ElevationHost.TEMPLATE_SUFFIX));
    }

    protected _buildMaterialName(): string {
        return TextUtils.BuildNameWithSuffix(this._buildTemplateName(), ElevationHost.MATERIAL_SUFFIX);
    }

    private _bindDisplayInternal(display: Nullable<IDisplay>): void {
        if (display && this._material) {
            if (IsHolographicBounds(this.display)) {
                this.material.holographicBounds = this.display;
            }
            if (this.display?.resolution) {
                this.material.displayResolution = this.display.resolution;
            }
        }
    }

    private _buildGridFactoryInternal(): IElevationGridFactory {
        return new ElevationGridFactory();
    }
}
