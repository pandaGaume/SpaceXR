import { ITileDirectory, ITileMetrics } from "../tiles/tiles.interfaces";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { GeodeticSystem } from "core/geodesy/geodesy.system";
import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";
export declare class Terrain {
    directory: ITileDirectory<Float32Array>;
    _directory: ITileDirectory<Float32Array>;
    _topology: IVerticesData;
    constructor(directory: ITileDirectory<Float32Array>, topology?: IVerticesData);
    get tileMetrics(): ITileMetrics;
    get tileSize(): number;
    get referenceGrid(): IVerticesData;
    protected buildRefGrid(width: number, height?: number): IVerticesData;
}
export declare class PlanetSurface extends Terrain {
    directory: ITileDirectory<Float32Array>;
    _system: GeodeticSystem;
    constructor(directory: ITileDirectory<Float32Array>, topology?: IVerticesData, ellipsoid?: Ellipsoid);
    get geodeticSystem(): GeodeticSystem;
    get ellipsoid(): Ellipsoid;
}
