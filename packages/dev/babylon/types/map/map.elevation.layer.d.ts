import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
import { ITileAddress, ITileDatasource, ITileMapLayer, ITileMapLayerOptions, ITileProvider, TileMapLayer } from "core/tiles";
export interface IElevationLayerOptions extends ITileMapLayerOptions {
    exageration?: number;
    insets?: ICartesian3;
}
export interface IElevationLayer extends ITileMapLayer<IDemInfos>, IElevationLayerOptions {
}
export declare class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    static readonly DefaultExageration: number;
    static readonly DefaultInsets: ICartesian3;
    static readonly ExagerationPropertyName: string;
    static readonly InsetsPropertyName: string;
    private _exageration?;
    private _insets?;
    constructor(name: string, provider: ITileProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean);
    get exageration(): number | undefined;
    set exageration(value: number | undefined);
    get insets(): ICartesian3 | undefined;
    set insets(value: ICartesian3 | undefined);
}
