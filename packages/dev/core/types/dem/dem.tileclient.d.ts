import { Nullable } from "../types";
import { FetchResult, ITileAddress, ITileClient, ITileMetrics } from "../tiles/tiles.interfaces";
import { IDemInfos } from "./dem.interfaces";
export declare class DemTileWebClient implements ITileClient<IDemInfos> {
    _elevationsDataSource: ITileClient<Float32Array>;
    _normalsDataSource?: ITileClient<Uint8ClampedArray | HTMLImageElement>;
    constructor(elevationSrc: ITileClient<Float32Array>, normalSrc?: ITileClient<Uint8ClampedArray | HTMLImageElement>);
    get metrics(): ITileMetrics;
    fetchAsync(request: ITileAddress, ...userArgs: unknown[]): Promise<FetchResult<Nullable<IDemInfos>>>;
    private computeNormals;
    private getNormalsWindows;
}
