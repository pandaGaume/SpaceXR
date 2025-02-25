import { Nullable } from "../types";
import { ITileAddress2, ITileClient, ITileMetrics } from "../tiles/tiles.interfaces";
import { IDemInfos } from "./dem.interfaces";
import { IGeoBounded } from "../geography";
import { FetchResult } from "../io";
export declare class DemTileWebClient implements ITileClient<IDemInfos> {
    _name: string;
    _zindex: number;
    _elevationsDataSource: ITileClient<Float32Array>;
    _normalsDataSource?: ITileClient<Uint8ClampedArray | HTMLImageElement>;
    constructor(name: string, elevationSrc: ITileClient<Float32Array>, normalSrc?: ITileClient<Uint8ClampedArray | HTMLImageElement>);
    get name(): string;
    get zindex(): number;
    set zindex(v: number);
    get metrics(): ITileMetrics;
    fetchAsync(request: ITileAddress2, env?: IGeoBounded, ...userArgs: unknown[]): Promise<FetchResult<ITileAddress2, Nullable<IDemInfos>>>;
    private computeNormals;
    private getNormalsWindows;
}
