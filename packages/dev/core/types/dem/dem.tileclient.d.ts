import { Nullable } from "../types";
import { FetchResult, ITileAddress, ITileClient, ITileMetrics } from "../tiles/tiles.interfaces";
import { IDemInfos } from "./dem.interfaces";
export declare class DemTileWebClient implements ITileClient<IDemInfos, ITileAddress> {
    _name: string;
    _elevationsDataSource: ITileClient<Float32Array, ITileAddress>;
    _normalsDataSource?: ITileClient<Uint8ClampedArray | HTMLImageElement, ITileAddress>;
    constructor(name: string, elevationSrc: ITileClient<Float32Array, ITileAddress>, normalSrc?: ITileClient<Uint8ClampedArray | HTMLImageElement, ITileAddress>);
    get name(): string;
    get metrics(): ITileMetrics;
    fetchAsync(request: ITileAddress, ...userArgs: unknown[]): Promise<FetchResult<Nullable<IDemInfos>>>;
    private computeNormals;
    private getNormalsWindows;
}
