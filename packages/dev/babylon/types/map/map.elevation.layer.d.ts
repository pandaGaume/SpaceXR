import { Color4, Material } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ICartesian3, ISize2 } from "core/geometry";
import { ILinkOptions, ITargetBlock, ITile, ITileAddress, ITileDatasource, ITileMapLayer, ITileMapLayerOptions, ITileProvider, TileMapLayer } from "core/tiles";
export interface IElevationLayerMaterialOptions {
    material?: Material;
    color?: Color4;
    shininess?: number;
    textureResolution?: ISize2;
}
export interface IElevationLayerOptions extends ITileMapLayerOptions, IElevationLayerMaterialOptions {
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
    static readonly ShininessPropertyName: string;
    static readonly TextureResolutionPropertyName: string;
    private _exageration?;
    private _insets?;
    private _color?;
    private _shininess?;
    private _material?;
    private _textureResolution?;
    constructor(name: string, provider: ITileProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationLayerOptions, enabled?: boolean);
    get exageration(): number | undefined;
    set exageration(value: number | undefined);
    get insets(): ICartesian3 | undefined;
    set insets(value: ICartesian3 | undefined);
    get color(): Color4 | undefined;
    set color(value: Color4 | undefined);
    get shininess(): number | undefined;
    set shininess(value: number | undefined);
    get textureResolution(): ISize2 | undefined;
    set textureResolution(value: ISize2 | undefined);
    get material(): Material | undefined;
    linkTo(target: ITargetBlock<ITile<IDemInfos>>, options?: ILinkOptions, ...args: Array<any>): void;
}
