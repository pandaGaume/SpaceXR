import { Material, Scene } from "@babylonjs/core";
import { VirtualDisplay, VirtualDisplayInputsSource } from "../display";
import { IMapTextureOptions, WebMapTexture } from "../materials";
import { ISize2 } from "core/geometry";
import { IPointerSource, IWheelSource, InputsNavigationTarget, PointerController } from "core/map";
import { ITileMap } from "core/tiles";
export declare class MapDisplay extends VirtualDisplay {
    static MaterialSuffix: string;
    static TextureSuffix: string;
    _content: WebMapTexture;
    _target: InputsNavigationTarget<VirtualDisplayInputsSource>;
    _controller: PointerController<IPointerSource & IWheelSource>;
    constructor(name: string, dimension: ISize2, options?: IMapTextureOptions, scene?: Scene);
    get content(): WebMapTexture;
    get map(): ITileMap<unknown>;
    protected _createTextureMap(name: string, options: IMapTextureOptions, scene: Scene): WebMapTexture;
    protected _createMaterial(name: string, texture: WebMapTexture, scene: Scene): Material;
    protected _createMaterialName(name: string): string;
    protected _createTextureName(name: string): string;
}
