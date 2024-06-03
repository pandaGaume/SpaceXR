import { IDemInfos } from "core/dem";
import { IHasTileMapLayerContainer, ITile, ITileMapLayer, ITileMapLayerContainer, ITileMetrics, ITileNavigationApi, ImageLayer, LayerContainer } from "core/tiles";
import { Observer } from "core/events";
import { Nullable, Scene, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";
import { Size2 } from "core/geometry";
import { IPointerSource, PointerController } from "core/map";
import { HolographicDisplay } from "../display";

// we use type of IDemInfos for elevation and rgb images for the texture.
export type Map3dTileContentType = IDemInfos | HTMLImageElement;

export interface IMap3DMetrics {
    resolution: Size2;
    dimension: Size2;
    scale: number;
    spatialResolution: Size2;

    getLevelOfDetail(center: IGeo2, metrics: ITileMetrics): number;
}

export interface IMap3dOptions {
    metrics: IMap3DMetrics;
}

export class Map3d extends TransformNode implements IHasTileMapLayerContainer<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>>, ITileNavigationApi<Map3d> {
    public static DefaultTextureSize: number = 1024;

    // the map logic. This is the main entry point for the map API.
    private _layers: ITileMapLayerContainer<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>>;
    private _addLayerObserver: Nullable<Observer<ITileMapLayer<Map3dTileContentType>>>;
    private _removeLayerObserver: Nullable<Observer<ITileMapLayer<Map3dTileContentType>>>;

    private _targetDisplay: Nullable<HolographicDisplay> = null;
    private _controller: Nullable<PointerController<IPointerSource>> = null;
    private _ownController = false;

    public constructor(name: string, options: IMap3dOptions, scene: Scene) {
        super(name, scene);

        // create the layer container
        this._layers = new LayerContainer<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>>();
        this._addLayerObserver = this._layers.layerAddedObservable.add(this._onLayerAdded.bind(this));
        this._removeLayerObserver = this._layers.layerRemovedObservable.add(this._onLayerRemoved.bind(this));
    }

    /// #region ITileNavigationApi
    public setViewMap(center: IGeo2 | number[], zoom?: number | undefined, rotation?: number | undefined): Map3d {
        return this;
    }
    public zoomMap(delta: number): Map3d {
        return this;
    }
    public zoomInMap(delta: number): Map3d {
        return this;
    }
    public zoomOutMap(delta: number): Map3d {
        return this;
    }
    public translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics | undefined): Map3d {
        return this;
    }
    public translateMap(dlat: number | IGeo2 | number[], dlon?: number | undefined): Map3d {
        return this;
    }
    public rotateMap(r: number): Map3d {
        return this;
    }
    /// #endregion ITileNavigationApi

    /// #region IHasTileMapLayerContainer
    public get layerContainer(): ITileMapLayerContainer<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>> {
        return this._layers;
    }
    /// #endregion IHasTileMapLayerContainer

    public withDisplay(display: HolographicDisplay): Map3d {
        this._targetDisplay = display;
        return this.withPointerControl(this._targetDisplay.pointerSource);
    }

    public withPointerControl(controller: PointerController<IPointerSource> | IPointerSource): Map3d {
        if (this._controller && this._ownController) {
            this._controller.dispose();
        }
        if (controller instanceof PointerController) {
            this._controller = controller;
        } else {
            this._controller = new PointerController(controller, this);
            this._ownController = true;
        }
        return this;
    }

    public dispose() {
        super.dispose();
        this._controller?.dispose();
        this._addLayerObserver?.disconnect();
        this._removeLayerObserver?.disconnect();
    }

    /// handlers
    protected _onLayerAdded(layer: ITileMapLayer<Map3dTileContentType>): void {
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerAdded(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onImageLayerAdded(layer);
        }
    }

    protected _onLayerRemoved(layer: ITileMapLayer<Map3dTileContentType>): void {
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerRemoved(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onImageLayerRemoved(layer);
        }
    }

    protected _onElevationLayerAdded(layer: ElevationLayer): void {
        // register the root of the layer under the map
        layer.root.parent = this;
        layer.linkTo(this);
        if (this._targetDisplay) {
            layer.bindDisplay(this._targetDisplay);
        }
    }

    protected _onElevationLayerRemoved(layer: ElevationLayer): void {
        layer.unlinkFrom(this);
        // unregister the root of the layer from the map
        layer.bindDisplay();
        layer.root.parent = null;
    }

    protected _onImageLayerAdded(layer: ImageLayer): void {
        layer.linkTo(this);
    }

    protected _onImageLayerRemoved(layer: ImageLayer): void {
        layer.unlinkFrom(this);
    }
}
