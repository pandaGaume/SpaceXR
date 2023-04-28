import { ITileAddress, ITileDirectory, ITileMetrics } from "../tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "../meshes/terrain.grid";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { GeodeticSystem } from "core/geodesy/geodesy.system";
import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";

/**
 * This is the model, which is also itself a view of the data access through geodetic system and specific grid topology..
 */
export class PlanetSurface {
    // data access
    _directory: ITileDirectory<Float32Array, ITileAddress>;

    // geometry
    _topology: IVerticesData;
    _system: GeodeticSystem;

    public constructor(public directory: ITileDirectory<Float32Array, ITileAddress>, ellipsoid?: Ellipsoid, topology?: IVerticesData) {
        this._directory = directory;
        this._system = new GeodeticSystem(ellipsoid || Ellipsoid.WGS84);
        this._topology = topology || this.buildRefGrid(this.tileSize);
    }

    public get tileMetrics(): ITileMetrics {
        return this._directory.metrics;
    }

    public get geodeticSystem(): GeodeticSystem {
        return this._system;
    }

    public get tileSize(): number {
        return this._directory.metrics.tileSize;
    }

    public get referenceGrid(): IVerticesData {
        return this._topology;
    }

    public get ellipsoid(): Ellipsoid {
        return this._system._ellipsoid;
    }

    protected buildRefGrid(width: number, height?: number): IVerticesData {
        const o = new TerrainGridOptions(width, height || width);
        return new TerrainNormalizedGridBuilder().withOptions(o).build();
    }
}
