import { ITileAddress, ITileDirectory, ITileMetrics } from "../tiles/tiles.interfaces";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { GeodeticSystem } from "core/geodesy/geodesy.system";
import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";
export declare class PlanetSurfaceModel {
    directory: ITileDirectory<Float32Array, ITileAddress>;
    _directory: ITileDirectory<Float32Array, ITileAddress>;
    _topology: IVerticesData;
    _system: GeodeticSystem;
    constructor(directory: ITileDirectory<Float32Array, ITileAddress>, ellipsoid?: Ellipsoid, topology?: IVerticesData);
    get tileMetrics(): ITileMetrics;
    get geodeticSystem(): GeodeticSystem;
    get tileSize(): number;
    get referenceGrid(): IVerticesData;
    get ellipsoid(): Ellipsoid;
    protected buildRefGrid(width: number, height?: number): IVerticesData;
}
