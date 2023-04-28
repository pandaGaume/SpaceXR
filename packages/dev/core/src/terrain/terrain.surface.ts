import { ITileAddress, ITileDirectory, ITileMetrics } from "../tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "../meshes/terrain.grid";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { GeodeticSystem } from "core/geodesy/geodesy.system";
import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";

export class Terrain {
    // data access
    _directory: ITileDirectory<Float32Array, ITileAddress>;
    // geometry
    _topology: IVerticesData;

    public constructor(public directory: ITileDirectory<Float32Array, ITileAddress>, topology?: IVerticesData) {
        this._directory = directory;
        this._topology = topology || this.buildRefGrid(this.tileSize);
    }

    public get tileMetrics(): ITileMetrics {
        return this._directory.metrics;
    }

    public get tileSize(): number {
        return this._directory.metrics.tileSize;
    }

    public get referenceGrid(): IVerticesData {
        return this._topology;
    }

    protected buildRefGrid(width: number, height?: number): IVerticesData {
        const o = new TerrainGridOptions(width, height || width);
        return new TerrainNormalizedGridBuilder().withOptions(o).build();
    }
}

export class PlanetSurface extends Terrain {
    // geodesy
    _system: GeodeticSystem;

    public constructor(public directory: ITileDirectory<Float32Array, ITileAddress>, topology?: IVerticesData, ellipsoid?: Ellipsoid) {
        super(directory, topology);
        this._system = new GeodeticSystem(ellipsoid || Ellipsoid.WGS84);
    }

    public get geodeticSystem(): GeodeticSystem {
        return this._system;
    }
    public get ellipsoid(): Ellipsoid {
        return this._system._ellipsoid;
    }
}
