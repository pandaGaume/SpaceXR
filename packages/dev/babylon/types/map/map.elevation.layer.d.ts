import { Color4, Material } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
import { ITileAddress, ITileDatasource, ITileMapLayer, ITileMapLayerOptions, ITileProvider, TileMapLayer } from "core/tiles";
export interface IElevationMaterialOptions {
    material?: Material;
    color?: Color4;
}
export interface IElevationLayerOptions extends ITileMapLayerOptions, IElevationMaterialOptions {
    exageration?: number;
    insets?: ICartesian3;
}
export interface IElevationLayer extends ITileMapLayer<IDemInfos>, IElevationLayerOptions {
}
export declare class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    static readonly DefaultColor: Color4;
    static readonly DefaultExageration: number;
    static readonly DefaultInsets: ICartesian3;
    static readonly ExagerationPropertyName: string;
    static readonly InsetsPropertyName: string;
    static readonly ColorPropertyName: string;
    private _exageration?;
    private _insets?;
    private _color?;
    private _material?;
    constructor(name: string, provider: ITileProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationLayerOptions, enabled?: boolean);
    get exageration(): number | undefined;
    set exageration(value: number | undefined);
    get insets(): ICartesian3 | undefined;
    set insets(value: ICartesian3 | undefined);
    get color(): Color4 | undefined;
    set color(value: Color4 | undefined);
    get material(): Material | undefined;
}
