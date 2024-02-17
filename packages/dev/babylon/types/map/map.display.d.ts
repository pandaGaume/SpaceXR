import { Material, Scene } from "@babylonjs/core";
import { VirtualDisplay, VirtualDisplayInputsSource } from "../display";
import { IMapTextureOptions, MapTexture } from "../materials";
import { ISize2 } from "core/geometry";
import { IPointerSource, InputsNavigationTarget, PointerController } from "core/map";
export declare class MapDisplay extends VirtualDisplay {
    static MaterialSuffix: string;
    static TextureSuffix: string;
    _map: MapTexture;
    _target: InputsNavigationTarget<VirtualDisplayInputsSource>;
    _controller: PointerController<IPointerSource>;
    constructor(name: string, dimension: ISize2, options?: IMapTextureOptions, scene?: Scene);
    get map(): MapTexture;
    protected _createTextureMap(name: string, options: IMapTextureOptions, scene: Scene): MapTexture;
    protected _createMaterial(name: string, texture: MapTexture, scene: Scene): Material;
    protected _createMaterialName(name: string): string;
    protected _createTextureName(name: string): string;
}
