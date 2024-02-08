import { AbstractMesh, EventState, Material, Mesh, Nullable, Scene, VertexData } from "@babylonjs/core";
import { IMemoryCache } from "core/cache";
import { IDemInfos, DemLayer } from "core/dem";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes";
import { ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileProvider, Tile, TileContentProvider, TileContentType, TileProvider } from "core/tiles";
import { TileBuilder } from "core/tiles/tiles.builder";

export class ElevationTile extends Tile<IDemInfos> {
    _surface: Nullable<AbstractMesh>; // may be a mesh or an instance.
    public constructor(x: number, y: number, levelOfDetail: number, data: IDemInfos) {
        super(x, y, levelOfDetail, data);
        this._surface = null;
    }
}

export interface IElevationTileOptions extends ITileMapLayerOptions {
    exageration?: number;
    gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    material?: Material;
}

///<summary>
/// A layer for elevation data. The layer serve as hos for elevation tiles and therefore the grid model used to display the elevation.
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
    _gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    _material: Nullable<Material>;

    public constructor(name: string, source: ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationTileOptions, enabled?: boolean) {
        super(name, source, options, enabled);
        this._exageration = options?.exageration ?? 1.0;
        this._gridOptions = options?.gridOptions;
        this._material = options?.material ?? null;
        this._grid = this._buildTopology();
        this._template = this._buildMesh(name);
    }

    protected _buildMesh(name: string, scene?: Nullable<Scene>): Mesh {
        const mesh = new Mesh(name, scene);
        this._grid.applyToMesh(mesh, true);
        this._template.material = this._material;
        return mesh;
    }

    protected _buildInstance(name: string, tile: ElevationTile): AbstractMesh {
        const instance = this._template.createInstance(name);
        instance.scaling.x = instance.scaling.y = this.metrics.tileSize;
        instance.scaling.z = 1.0;
        return instance;
    }

    protected _buildProvider(source: ITileDatasource<IDemInfos, ITileAddress>, cache?: IMemoryCache<string, TileContentType<IDemInfos>>): ITileProvider<IDemInfos> {
        const contentProvider = new TileContentProvider<IDemInfos>(source, cache);
        const factory = new TileBuilder<IDemInfos>().withMetrics(source.metrics).withType(ElevationTile);
        return new TileProvider(contentProvider, factory);
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
                .withScale(1, -1) // we consider a grid of "texel" or "pixel" oriented as an image is oriented in display
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
            tile._surface = this._buildInstance(this._buildMeshName(tile), tile);
        }
    }

    protected _onTileRemoved(eventData: Array<ElevationTile>, eventState: EventState): void {
        super._onTileRemoved(eventData, eventState);
        for (const tile of eventData) {
            tile._surface?.dispose();
            tile._surface = null;
        }
    }

    protected _buildMeshName(tile: ElevationTile): string {
        return `${this.name}-${tile.quadkey}`;
    }
}
