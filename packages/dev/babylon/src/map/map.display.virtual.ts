import { Material, Mesh, Scene, StandardMaterial } from "@babylonjs/core";
import { VirtualDisplay, VirtualDisplayInputsSource } from "../display";
import { IMapTextureOptions, WebMapTexture } from "../materials";
import { ISize2 } from "core/geometry";
import { IPointerSource, IWheelSource, InputsNavigationTarget, PointerController } from "core/map";
import { ITileMap } from "core/tiles";

export class MapDisplay extends VirtualDisplay {
    static MaterialSuffix = "material";
    static TextureSuffix = "texture";

    _content: WebMapTexture;
    _target: InputsNavigationTarget<VirtualDisplayInputsSource>;
    _controller: PointerController<IPointerSource & IWheelSource>;

    public constructor(name: string, dimension: ISize2, options?: IMapTextureOptions, scene?: Mesh | Scene) {
        options = options ?? WebMapTexture.OptionsHD();
        super(name, dimension, options, scene);
        this._content = this._createTextureMap(name, options, this.getScene());
        this.node.material = this._createMaterial(name, this._content, this.getScene());

        this._target = new InputsNavigationTarget(this._content?.map);
        this._controller = new PointerController(this.pointerSource, this._target);
    }

    get content(): WebMapTexture {
        return this._content;
    }

    get map(): ITileMap<unknown> {
        return this._content.map;
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
