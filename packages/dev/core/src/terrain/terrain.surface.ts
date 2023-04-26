import { TileClient } from "../tiles/tiles.client";
import { ITile, ITileAddress, ITileBuilder, ITileClient, ITileClientOptions, ITileMetrics, ITileSystem } from "../tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "../meshes/terrain.grid";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { GeodeticSystem } from "core/geodesy/geodesy.system";
import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";
import { TileSystem } from "core/tiles/tiles.system";
import { DEMTile } from "core/tiles/tiles.dem";
import { Nullable } from "core/types";

export interface IPlanetSurfaceOption {
    tileMetrics: ITileMetrics;
    demClientOptions?: ITileClientOptions<Float32Array>;
    normalClientOptions?: ITileClientOptions<Float32Array>;
    ellipsoid?: Ellipsoid;
}

export class PlanetSurfaceTileBuilder implements ITileBuilder<Float32Array, DEMTile> {
    public static Shared = new PlanetSurfaceTileBuilder();

    public build(data: Array<Nullable<Float32Array>>, address: ITileAddress): DEMTile | undefined {
        if (data.length > 0 && data[0] !== null) {
            const tile = new DEMTile(data[0], address);
            if (data.length > 1 && data[1] !== null) {
                tile.normals = data[1];
            }
            return tile;
        }
        return undefined;
    }
}

export class PlanetSurface {
    // options
    _o: IPlanetSurfaceOption;

    // geometry
    _grid: IVerticesData;
    _system: GeodeticSystem;

    // tile system
    _demSystem?: ITileSystem<Float32Array, DEMTile, ITileAddress>;

    public constructor(options: IPlanetSurfaceOption) {
        this._o = options;
        if (this._o?.demClientOptions) {
            const clients = [];
            clients.push(new TileClient<Float32Array, ITileAddress>(this._o?.demClientOptions));
            if (this._o?.normalClientOptions) {
                clients.push(new TileClient<Float32Array, ITileAddress>(this._o?.normalClientOptions));
            }
            this._demSystem = new TileSystem<Float32Array, DEMTile, ITileAddress>(this._o.tileMetrics, clients, PlanetSurfaceTileBuilder.Shared);
        }
        this._grid = this.buildRefGrid(this.tileSize, this.tileSize);
        this._system = new GeodeticSystem(this._o.ellipsoid);
    }

    public get options(): IPlanetSurfaceOption {
        return this._o;
    }

    public get tileSize(): number {
        return this._o.tileMetrics.tileSize;
    }

    public get referenceGrid(): IVerticesData {
        return this._grid;
    }

    public get geodeticSystem(): GeodeticSystem {
        return this._system;
    }

    private buildRefGrid(width: number, height: number): IVerticesData {
        const o = new TerrainGridOptions(width, height);
        return new TerrainNormalizedGridBuilder().withOptions(o).build();
    }
}
