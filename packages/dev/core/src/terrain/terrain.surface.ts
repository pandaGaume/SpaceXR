import { TileClient } from "../tiles/tiles.client";
import { ITileAddress, ITileClient, ITileClientOptions, ITileMetrics } from "../tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "../meshes/terrain.grid";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { GeodeticSystem } from "core/geodesy/geodesy.system";
import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";

export interface IPlanetSurfaceOption {
    tileMetrics: ITileMetrics;
    demClientOptions?: ITileClientOptions<Float32Array>;
    normalClientOptions?: ITileClientOptions<Float32Array>;
    ellipsoid?: Ellipsoid;
}

export class PlanetSurface {
    _o: IPlanetSurfaceOption;
    _demClient?: ITileClient<Float32Array, ITileAddress>;
    _normalClient?: ITileClient<Float32Array, ITileAddress>;
    _grid: IVerticesData;
    _system: GeodeticSystem;

    public constructor(options: IPlanetSurfaceOption) {
        this._o = options;
        if (this._o?.demClientOptions) {
            this._demClient = new TileClient<Float32Array, ITileAddress>(this._o?.demClientOptions);
        }
        if (this._o?.normalClientOptions) {
            this._normalClient = new TileClient<Float32Array, ITileAddress>(this._o?.normalClientOptions);
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

    public get demClient(): ITileClient<Float32Array, ITileAddress> {
        return this.demClient;
    }

    public get normalClient(): ITileClient<Float32Array, ITileAddress> {
        return this.normalClient;
    }

    public get hasAltitude(): boolean {
        return this._demClient !== undefined;
    }

    public get hasNormals(): boolean {
        return this._normalClient !== undefined;
    }

    public get geodeticSystem(): GeodeticSystem {
        return this._system;
    }

    private buildRefGrid(width: number, height: number): IVerticesData {
        const o = new TerrainGridOptions(width, height);
        return new TerrainNormalizedGridBuilder().withOptions(o).build();
    }
}
