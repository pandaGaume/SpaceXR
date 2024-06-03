import { AbstractMesh, Mesh, Nullable, Scene, TransformNode, VertexData, Material } from "@babylonjs/core";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes";
import { IPipelineMessageType, ITargetBlock, ITile, ITileMapLayer, ITileMapLayerOptions, ITileMetrics, ITileNavigationState, Tile } from "core/tiles";
import { ICartesian2, ICartesian3 } from "core/geometry";
import { PropertyChangedEventArgs, EventState, Observer } from "core/events";
import { Bearing, IGeo2 } from "core/geography";
import { WebMapMaterial } from "../materials";
import { Map3dScaleController, hasMapScale } from "./map.scale.controller";
import { HolographicDisplay, hasHolographicBounds } from "../display";
import { IElevationMesh } from "./map.elevation.tile";

/// <summary>
/// Options for elevation tiles.
/// </summary>
export interface IElevationTileOptions extends ITileMapLayerOptions {
    exageration?: number;
    gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    insets?: ICartesian3;
    material?: Material;
}

///<summary>
/// A layer for elevation data. The layer serve as host for elevation tiles and therefore the grid model used to display the elevation.
/// </summary>
export class ElevationHost implements ITargetBlock<ITile<IElevationMesh>> {
    private static InitZ(column: number, row: number, w: number, h: number): number {
        let i = column == w - 1 ? 1 : 0;
        let j = row == h - 1 ? 2 : 0;
        return i + j;
    }

    private static InitUV(column: number, row: number, w: number, h: number): number[] {
        let u = column == w - 1 ? 0 : column / (w - 2);
        let v = row == h - 1 ? 0 : row / (h - 2);
        return [u, v];
    }

    _layer: ITileMapLayer<IElevationMesh>;
    _grid: VertexData;
    _template: Mesh;
    _exageration?: number;
    _insets?: ICartesian3;
    _gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    _root: TransformNode;
    _tilesRoot: TransformNode;

    // cached cartesian center
    _cartesianCenter: Nullable<ICartesian2>;

    // scale controller
    _scaleController: Nullable<Map3dScaleController> = null;
    _scaleObserver: Nullable<Observer<ICartesian3>> = null;

    public constructor(layer: ITileMapLayer<IElevationMesh>, options?: IElevationTileOptions, enabled?: boolean) {
        this._layer = layer;
        this._layer.linkTo(this);
        this._exageration = options?.exageration ?? 1.0;
        this._gridOptions = options?.gridOptions;
        this._insets = options?.insets;
        this._root = new TransformNode(this._buildNameWithSuffix("root"));
        if (this._insets) {
            this._root.position.set(this._insets.x, this._insets.y, this._insets.z);
        }
        this._tilesRoot = new TransformNode(this._buildNameWithSuffix("tiles"));
        this._tilesRoot.parent = this._root;
        this._grid = this._buildTopology();
        this._template = this._buildMesh(layer.name, options?.material ?? null);
        this._cartesianCenter = null;
        this.navigation.propertyChangedObservable.add(this._onNavigationPropertyChanged.bind(this));
    }

    name?: string | undefined;

    public get navigation(): ITileNavigationState {
        return this._layer.navigation;
    }

    public get metrics(): ITileMetrics {
        return this._layer.metrics;
    }

    public get root(): TransformNode {
        return this._root;
    }

    //#region ITargetBlock
    public added(eventData: IPipelineMessageType<ITile<IElevationMesh>>, eventState: EventState): void {
        for (const tile of eventData) {
            this._onTileAdded(tile, eventState);
        }
    }
    public removed(eventData: IPipelineMessageType<ITile<IElevationMesh>>, eventState: EventState): void {
        for (const tile of eventData) {
            this._onTileRemoved(tile, eventState);
        }
    }
    public updated(eventData: IPipelineMessageType<ITile<IElevationMesh>>, eventState: EventState): void {
        for (const tile of eventData) {
            this._onTileUpdated(tile, eventState);
        }
    }
    //#endregion

    public bindDisplay(display?: HolographicDisplay): void {
        if (this._scaleController) {
            this._scaleController.dispose();
            this._scaleController = null;
        }
        if (this._scaleObserver) {
            this._scaleObserver.disconnect();
            this._scaleObserver = null;
        }
        var m = this.mesh.material;
        if (m && hasHolographicBounds(m)) {
            m.holographicBounds = null;
        }

        if (display) {
            this._scaleController = new Map3dScaleController(display, this.navigation, this.metrics);
            this._scaleObserver = this._scaleController.scaleChangedObservable.add(this._onScaleChanged.bind(this));
            this._onScaleChanged(Map3dScaleController.GetScale(display, this.navigation, this.metrics));

            var m = this.mesh.material;
            if (m && hasHolographicBounds(m)) {
                m.holographicBounds = display;
            }
        }
    }

    protected _onScaleChanged(scale: ICartesian3): void {
        const material = this._template.material;
        if (material && hasMapScale(material)) {
            material.mapScale = scale;
        }
    }

    /**
     * The mesh used as template for the elevation tiles. This mesh is intended to be decorated with specific material.
     * @returns the mesh used as template for the elevation tiles.
     */
    public get mesh(): Mesh {
        return this._template;
    }

    protected _buildMesh(name: string, material: Nullable<Material>, scene?: Scene): Mesh {
        const mesh = this._createMesh(this._buildNameWithSuffix("template"), scene);
        this._grid.applyToMesh(mesh, true);
        mesh.isVisible = false;
        mesh.material = material ?? this._createDefaultMaterial(scene);
        return mesh;
    }

    protected _createMesh(name: string, scene?: Nullable<Scene>): Mesh {
        return new Mesh(name, scene);
    }

    protected _buildInstance(name: string, tile: ITile<IElevationMesh>): AbstractMesh {
        const instance = this._template.createInstance(name);
        instance.scaling.x = instance.scaling.y = this.metrics.tileSize;
        instance.scaling.z = 1.0; // exageration is hold by the tiles root scaling.
        return instance;
    }

    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "center": {
                const geo = event.newValue as IGeo2;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, event.source.lod);
                this._onCenterChanged(this._cartesianCenter);
                break;
            }
            case "zoom": {
                const geo = event.source.center;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, event.source.lod);
                this._onCenterChanged(this._cartesianCenter);
                this._onZoomChanged(event.source.scale);
                break;
            }
            case "azimuth": {
                this._onAzimuthChanged(event.newValue as Bearing);
                break;
            }
        }
    }

    protected _onZoomChanged(scale: number): void {
        this._tilesRoot.scaling.x = this._tilesRoot.scaling.y = scale;
        this._tilesRoot.scaling.z = (this._exageration ?? 1.0) * scale;
    }

    protected _onAzimuthChanged(azimuth: Bearing): void {
        this._tilesRoot.rotation.z = azimuth.radian;
    }

    protected _onCenterChanged(center: Nullable<ICartesian2>): void {
        if (center) {
            const tiles = this._layer.activTiles;
            if (!tiles || !tiles.count) {
                return;
            }
            for (const tile of tiles) {
                this._setTilePosition(tile, center);
            }
        }
    }

    protected _setTilePosition(tile: ITile<IElevationMesh>, center: ICartesian2): void {
        if (tile.rect && tile.content?.surface) {
            const c = tile.rect.center;
            const s = tile.content?.surface;
            const x = c.x - center.x;
            const y = c.y - center.y;
            const p = s.position;
            p.x = -x;
            p.y = -y;
            p.z = 0;
        }
    }

    protected _buildTopology(): VertexData {
        const o = this._buildTerrainOptions(this._gridOptions);
        const data = new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
        return data;
    }

    protected _buildTerrainOptions(options?: TerrainGridOptions | TerrainGridOptionsBuilder): TerrainGridOptions {
        if (!options) {
            const s = this.metrics?.tileSize;
            return new TerrainGridOptionsBuilder()
                .withColumns(s + 1) // add one column to fill the gap
                .withRows(s + 1) // add one row to fill the gap - optional as by default the builder build a square if one of the dimension is missing. Added for clarity.
                .withScale(-1, 1) // we consider a grid oriented with babylonjs coordinate system
                .withInvertIndices(true) //  we need to invert indices as we reverse x
                .withZInitializer(ElevationHost.InitZ) // register the z initializer, which serve as referencing the texture depth
                .withUvs(true) // generate uvs.
                .withUVInitializer(ElevationHost.InitUV) // register the uv initializer, which serve as referencing the texture coordinate used in conjunction with depth
                .build();
        }
        if (options instanceof TerrainGridOptionsBuilder) {
            return options.build();
        }
        return options;
    }

    protected _onTileAdded(tile: ITile<IElevationMesh>, eventState: EventState): void {
        if (tile.content) {
            tile.content.surface = this._buildInstance(this._buildNameWithSuffix(tile.quadkey), tile);
            if (this._cartesianCenter) {
                this._setTilePosition(tile, this._cartesianCenter);
            }
            tile.content.surface.parent = this._tilesRoot;
        }
    }

    protected _onTileRemoved(tile: ITile<IElevationMesh>, eventState: EventState): void {
        if (tile.content) {
            tile.content.surface?.dispose();
            tile.content.surface = null;
        }
    }

    protected _onTileUpdated(tile: ITile<IElevationMesh>, eventState: EventState): void {}

    protected _buildNameWithSuffix(suffix: string): string {
        return `${this.name}.${suffix}`;
    }

    protected _createDefaultMaterial(scene?: Scene): Material {
        return new WebMapMaterial(this._buildNameWithSuffix("material"), scene);
    }
}
