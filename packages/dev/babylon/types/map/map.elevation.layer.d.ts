import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
import { ITileAddress, ITileContentProvider, ITileDatasource, TileMapLayer } from "core/tiles";
import { IElevationLayer, IElevationLayerOptions } from "./map.elevation.interfaces";
export declare class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    static readonly DefaultExageration: number;
    static readonly DefaultInsets: ICartesian3;
    static readonly ExagerationPropertyName: string;
    static readonly OffsetsPropertyName: string;
    private _exageration?;
    private _offsets?;
    constructor(name: string, provider: ITileContentProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationLayerOptions, enabled?: boolean);
    get exageration(): number | undefined;
    set exageration(value: number | undefined);
    get offsets(): ICartesian3 | undefined;
    set offsets(value: ICartesian3 | undefined);
}
