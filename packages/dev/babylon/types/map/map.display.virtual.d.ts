import { Material, Scene } from "@babylonjs/core";
import { VirtualDisplay, VirtualDisplayInputsSource } from "../display";
import { IMapTextureOptions, WebMapTexture } from "../materials";
import { ISize2 } from "core/geometry";
import { IPointerSource, IWheelSource, InputsNavigationTarget, PointerController } from "core/map";
export declare class MapDisplay extends VirtualDisplay {
    static MaterialSuffix: string;
    static TextureSuffix: string;
    _map: WebMapTexture;
    _target: InputsNavigationTarget<VirtualDisplayInputsSource>;
    _controller: PointerController<IPointerSource & IWheelSource>;
    constructor(name: string, dimension: ISize2, options?: IMapTextureOptions, scene?: Scene);
    get map(): WebMapTexture;
    protected _createTextureMap(name: string, options: IMapTextureOptions, scene: Scene): WebMapTexture;
    protected _createMaterial(name: string, texture: WebMapTexture, scene: Scene): Material;
    protected _createMaterialName(name: string): string;
    protected _createTextureName(name: string): string;
}
