import { ITileAddress, ITileClient, ITileClientOptions, ITileMetrics } from "../tiles/tiles.interfaces";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { GeodeticSystem } from "core/geodesy/geodesy.system";
import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";
export interface IPlanetSurfaceOption {
    tileMetrics: ITileMetrics;
    demClientOptions?: ITileClientOptions<Float32Array>;
    normalClientOptions?: ITileClientOptions<Float32Array>;
    ellipsoid?: Ellipsoid;
}
export declare class PlanetSurface {
    _o: IPlanetSurfaceOption;
    _demClient?: ITileClient<Float32Array, ITileAddress>;
    _normalClient?: ITileClient<Float32Array, ITileAddress>;
    _grid: IVerticesData;
    _system: GeodeticSystem;
    constructor(options: IPlanetSurfaceOption);
    get options(): IPlanetSurfaceOption;
    get tileSize(): number;
    get referenceGrid(): IVerticesData;
    get demClient(): ITileClient<Float32Array, ITileAddress>;
    get normalClient(): ITileClient<Float32Array, ITileAddress>;
    get hasAltitude(): boolean;
    get hasNormals(): boolean;
    get geodeticSystem(): GeodeticSystem;
    private buildRefGrid;
}
