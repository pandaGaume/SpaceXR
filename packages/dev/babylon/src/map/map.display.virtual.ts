import { Material, Scene, StandardMaterial } from "@babylonjs/core";
import { VirtualDisplay, VirtualDisplayInputsSource } from "../display";
import { IMapTextureOptions, WebMapTexture } from "../materials";
import { ISize2 } from "core/geometry";
import { IPointerSource, InputsNavigationTarget, PointerController } from "core/map";

export class MapDisplay extends VirtualDisplay {
    static MaterialSuffix = "material";
    static TextureSuffix = "texture";

    _map: WebMapTexture;
    _target: InputsNavigationTarget<VirtualDisplayInputsSource>;
    _controller: PointerController<IPointerSource>;

    constructor(name: string, dimension: ISize2, options?: IMapTextureOptions, buildClipPlanes: boolean = false, scene?: Scene) {
        options = options ?? WebMapTexture.OptionsHD();
        super(name, dimension, options, buildClipPlanes, scene);
        this._map = this._createTextureMap(name, options, scene ?? this.getScene());
        this.material = this._createMaterial(name, this._map, scene ?? this.getScene());
        this._target = new InputsNavigationTarget(this._map);
        this._controller = new PointerController(this.pointerSource, this._target);
    }

    get map(): WebMapTexture {
        return this._map;
    }

    protected _createTextureMap(name: string, options: IMapTextureOptions, scene: Scene): WebMapTexture {
        options = options ?? WebMapTexture.OptionsHD();
        return new WebMapTexture(this._createTextureName(name), options, scene);
    }

    protected _createMaterial(name: string, texture: WebMapTexture, scene: Scene): Material {
        const material = new StandardMaterial(this._createMaterialName(name), scene);
        material.diffuseTexture = texture;
        return material;
    }

    protected _createMaterialName(name: string): string {
        return `${name}_${MapDisplay.MaterialSuffix}`;
    }

    protected _createTextureName(name: string): string {
        return `${name}_${MapDisplay.TextureSuffix}`;
    }
}
