import { Color4, Material } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { PropertyChangedEventArgs } from "core/events";
import { Cartesian3, ICartesian3, ISize2 } from "core/geometry";
import { ILinkOptions, ITargetBlock, ITile, ITileAddress, ITileDatasource, ITileMapLayer, ITileMapLayerOptions, ITileProvider, TileMapLayer } from "core/tiles";

export interface IElevationLayerMaterialOptions {
    material?: Material; // this is the default material to use. If defined, superseed any other material options.
    color?: Color4;
    shininess?: number;
    textureResolution?: ISize2;
}

export interface IElevationLayerOptions extends ITileMapLayerOptions<IDemInfos>, IElevationLayerMaterialOptions {
    exageration?: number;
    insets?: ICartesian3;
}

export interface IElevationLayer extends ITileMapLayer<IDemInfos>, IElevationLayerOptions {}

export class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    public static readonly DefaultColor: Color4 = Color4.FromInts(70, 130, 180, 255);
    public static readonly DefaultExageration: number = 1.0;
    public static readonly DefaultInsets: ICartesian3 = Cartesian3.Zero();

    public static readonly ExagerationPropertyName: string = "exageration";
    public static readonly InsetsPropertyName: string = "insets";
    public static readonly ColorPropertyName: string = "color";
    public static readonly ShininessPropertyName: string = "shininess";
    public static readonly TextureResolutionPropertyName: string = "textureResolution";

    private _exageration?: number;
    private _insets?: ICartesian3;
    private _color?: Color4;
    private _shininess?: number;
    private _material?: Material;
    private _textureResolution?: ISize2;

    public constructor(name: string, provider: ITileProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationLayerOptions, enabled?: boolean) {
        super(name, provider, options, enabled);
        this._insets = options?.insets ?? ElevationLayer.DefaultInsets;
        this._exageration = options?.exageration ?? ElevationLayer.DefaultExageration;
        this._color = options?.color;
        this._material = options?.material;
        this._shininess = options?.shininess;
        this._textureResolution = options?.textureResolution;
    }

    public get exageration(): number | undefined {
        return this._exageration;
    }

    public set exageration(value: number | undefined) {
        if (this._exageration === value) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._exageration;
            this._exageration = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, number>(this, oldValue, this._exageration, ElevationLayer.ExagerationPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }

        this._exageration = value;
    }

    public get insets(): ICartesian3 | undefined {
        return this._insets;
    }

    public set insets(value: ICartesian3 | undefined) {
        if (this._insets === value) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._insets;
            this._insets = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, ICartesian3>(this, oldValue, this._insets, ElevationLayer.InsetsPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }

        this._insets = value;
    }

    public get color(): Color4 | undefined {
        return this._color;
    }

    public set color(value: Color4 | undefined) {
        if (this._color === value) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._exageration;
            this._color = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, number>(this, oldValue, this._exageration, ElevationLayer.ColorPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }

        this._color = value;
    }

    public get shininess(): number | undefined {
        return this._shininess;
    }

    public set shininess(value: number | undefined) {
        if (this._shininess === value) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._shininess;
            this._shininess = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, number>(this, oldValue, this._shininess, ElevationLayer.ShininessPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }

        this._shininess = value;
    }

    public get textureResolution(): ISize2 | undefined {
        return this._textureResolution;
    }

    public set textureResolution(value: ISize2 | undefined) {
        if (this._textureResolution === value) return;
        if (value?.width == this._textureResolution?.width && value?.height == this._textureResolution?.height) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._textureResolution;
            this._textureResolution = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, ISize2>(this, oldValue, this._textureResolution, ElevationLayer.TextureResolutionPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }
    }

    public get material(): Material | undefined {
        return this._material;
    }

    public linkTo(target: ITargetBlock<ITile<IDemInfos>>, options?: ILinkOptions<IDemInfos>, ...args: Array<any>): void {
        if (args.length > 0 && args[0] instanceof Material) {
            this._material = args[0];
        }
    }
}
