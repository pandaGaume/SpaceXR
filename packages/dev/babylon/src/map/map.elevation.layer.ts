import { AbstractMesh, Mesh, Nullable, Scene, TransformNode, VertexData, Material } from "@babylonjs/core";
import { IMemoryCache } from "core/cache";
import { IDemInfos, DemLayer } from "core/dem";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes";
import { ITile, ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileNavigationState, ITileProvider, Tile, TileContentType } from "core/tiles";
import { ICartesian2, ICartesian3 } from "core/geometry";
import { PropertyChangedEventArgs, EventState } from "core/events";
import { Bearing, IGeo2 } from "core/geography";

export interface IElevationTile extends ITile<IDemInfos> {
    surface: Nullable<AbstractMesh>;
}

/// <summary>
/// A tile for elevation data. The tile serve as host for elevation data and therefore the instanced mesh used to display the elevation.
/// </summary>
export class ElevationTile extends Tile<IDemInfos> implements ElevationTile {
    _surface: Nullable<AbstractMesh>; // may be a mesh or an instance.
    public constructor(x: number, y: number, levelOfDetail: number, data: IDemInfos) {
        super(x, y, levelOfDetail, data);
        this._surface = null;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }
}

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
export class ElevationLayer extends DemLayer {
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

    _grid: VertexData;
    _template: Mesh;
    _exageration?: number;
    _insets?: ICartesian3;
    _gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    _root: TransformNode;
    _tilesRoot: TransformNode;
    // cached cartesian center
    _cartesianCenter: Nullable<ICartesian2>;

    public constructor(name: string, source: ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationTileOptions, enabled?: boolean) {
        super(name, source, options, enabled);
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
        this._template = this._buildMesh(name);
        this._template.material = options?.material ?? null;
        this._cartesianCenter = null;
        this.navigation.propertyChangedObservable.add(this._onNavigationPropertyChanged.bind(this));
    }

    public get root(): TransformNode {
        return this._root;
    }

    /**
     * The mesh used as template for the elevation tiles. This mesh is intended to be decorated with specific material.
     * @returns the mesh used as template for the elevation tiles.
     */
    public get mesh(): Mesh {
        return this._template;
    }

    protected _buildMesh(name: string, scene?: Nullable<Scene>): Mesh {
        const mesh = this._createMesh(this._buildNameWithSuffix("template"), scene);
        this._grid.applyToMesh(mesh, true);
        mesh.isVisible = false;
        return mesh;
    }

    protected _createMesh(name: string, scene?: Nullable<Scene>): Mesh {
        return new Mesh(name, scene);
    }

    protected _buildInstance(name: string, tile: ElevationTile): AbstractMesh {
        const instance = this._template.createInstance(name);
        instance.scaling.x = instance.scaling.y = this.metrics.tileSize;
        instance.scaling.z = 1.0; // exageration is hold by the tiles root scaling.
        return instance;
    }

    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "center": {
                const geo = event.newValue as IGeo2;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, this._state.lod);
                this._onCenterChanged(this._cartesianCenter);
                break;
            }
            case "zoom": {
                const geo = this._state.center;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, this._state.lod);
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
            const tiles = this.activTiles;
            if (!tiles || !tiles.count) {
                return;
            }
            for (const tile of tiles) {
                if (tile instanceof ElevationTile) {
                    this._setTilePosition(tile, center);
                }
            }
        }
    }

    protected _setTilePosition(tile: ElevationTile, center: ICartesian2): void {
        if (tile.rect && tile.surface) {
            const c = tile.rect.center;
            const s = tile.surface;
            const x = c.x - center.x;
            const y = c.y - center.y;
            const p = s.position;
            p.x = -x;
            p.y = -y;
            p.z = 0;
        }
    }

    // override in order to build the correct tile type
    protected _buildProvider(
        source: ITileDatasource<IDemInfos, ITileAddress>,
        cache?: IMemoryCache<string, TileContentType<IDemInfos>>,
        type?: new (...args: any[]) => ITile<IDemInfos>
    ): ITileProvider<IDemInfos> {
        return super._buildProvider(source, cache, type ?? ElevationTile);
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
                .withScale(1, -1) // we consider a grid of "texel" oriented as an image is oriented in display
                .withInvertIndices(true) //  we need to invert indices as we reverse y
                .withZInitializer(ElevationLayer.InitZ) // register the z initializer, which serve as referencing the texture depth
                .withUvs(true) // generate uvs.
                .withUVInitializer(ElevationLayer.InitUV) // register the uv initializer, which serve as referencing the texture coordinate used in conjunction with depth
                .build();
        }
        if (options instanceof TerrainGridOptionsBuilder) {
            return options.build();
        }
        return options;
    }

    protected _onTileAdded(eventData: Array<ElevationTile>, eventState: EventState): void {
        super._onTileAdded(eventData, eventState);
        for (const tile of eventData) {
            tile._surface = this._buildInstance(this._buildNameWithSuffix(tile.quadkey), tile);
            if (this._cartesianCenter) {
                this._setTilePosition(tile, this._cartesianCenter);
            }
            tile._surface.parent = this._tilesRoot;
        }
    }

    protected _onTileRemoved(eventData: Array<ElevationTile>, eventState: EventState): void {
        super._onTileRemoved(eventData, eventState);
        for (const tile of eventData) {
            tile._surface?.dispose();
            tile._surface = null;
        }
    }

    protected _buildNameWithSuffix(suffix: string): string {
        return `${this.name}.${suffix}`;
    }
}
